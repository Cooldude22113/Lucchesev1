"""
routes/chat.py
──────────────
Main chat endpoint and its supporting logic:
  - Memory helpers (ingest, classify, dedup, search, RAG)
  - Explicit memory commands (remember / forget)
  - Web search
  - System prompt builder
  - POST /chat

Every request is traced step-by-step (routes/tracer.py): readable lines in the
backend terminal while the message processes, and a full record in the traces
table for the admin Debug tab.
"""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import httpx
import uuid
import re
import json
import time
import asyncio
from datetime import datetime, timezone
from ddgs import DDGS
from routes.memory import search_memory, ingest_exchange, should_ingest, detect_memory_command, handle_memory_command
from routes.database import save_message
from routes.config import OLLAMA_URL, MODEL_FAST, MODEL_DEEP, ANTHROPIC_API_KEY, CHAT_PROVIDER
from routes import tracer


router = APIRouter()

CLAUDE_MODEL = "claude-sonnet-4-6"


# ── Request model ─────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message:         str
    history:         Optional[list] = []
    conversation_id: Optional[str]  = None
    deep:            Optional[bool] = False

# ── Web search ────────────────────────────────────────────────────────────────
WEB_TRIGGERS = [
    r"\b(latest|recent|current news|today|tonight)\b",
    r"\b(news|weather|score|results?|standings?)\b",
    r"\b(search|look up|google)\b",
    r"\b(released?|launched?|announced?)\b",
    r"\b(final|winner|champion|trophy)\b",
]

INTERNAL_SIGNALS = [
    "my ", "i am", "i'm", "remember",
    "what have i", "what did i",
]


def needs_web_search(message: str) -> tuple[bool, dict]:
    """Decide whether to run a web search, and say why: (decision, reason)."""
    msg = message.lower()

    url_match = re.search(r'https?://|www\.|\.co\.uk|\.com|\.io', msg)
    if url_match:
        return True, {"rule": "url", "matched": url_match.group(0)}

    for signal in INTERNAL_SIGNALS:
        if signal in msg:
            return False, {"rule": "suppressed", "matched": signal}

    for pattern in WEB_TRIGGERS:
        match = re.search(pattern, msg)
        if match:
            return True, {"rule": "trigger", "matched": match.group(0)}

    return False, {"rule": "no_match", "matched": None}


async def do_web_search(query: str, max_results: int = 4) -> str:
    start = time.perf_counter()
    try:
        results = await asyncio.to_thread(
            lambda: list(DDGS().text(query, max_results=max_results))
        )
        duration = (time.perf_counter() - start) * 1000
        if not results:
            tracer.current().add_step(
                "web_search", "Searched DuckDuckGo → nothing came back.",
                detail={"query": query, "result_count": 0}, duration_ms=duration,
            )
            return ""
        lines = ["[Web search results:]"]
        for r in results:
            lines.append(f"• {r.get('title', '')}: {r.get('body', '')} ({r.get('href', '')})")
        text = "\n".join(lines)
        tracer.current().add_step(
            "web_search", f"Searched DuckDuckGo → {len(results)} results.",
            detail={"query": query, "result_count": len(results), "results_text": text},
            duration_ms=duration,
        )
        return text
    except Exception as e:
        tracer.current().add_step(
            "web_search", "Web search failed — carrying on without web results.",
            status="error", error=f"{type(e).__name__}: {e}",
            detail={"query": query},
            duration_ms=(time.perf_counter() - start) * 1000,
        )
        return ""


# ── System prompt builder ─────────────────────────────────────────────────────
def build_system_prompt(web_context: str) -> str:
    """
    Assemble the full system prompt: today's date, the base persona, and —
    when a web search ran — a section with the results.
    """
    now = datetime.now().strftime("%A, %d %B %Y")

    base = """You are Lucchese, the personal AI of Alex Hammond.

You know Alex well. Speak to him like a straight-talking, highly knowledgeable friend — not an assistant trying to please him.

Be direct and assertive. State things confidently without hedging.
Never use phrases like "it seems", "perhaps", "you might want to", "it could be", "I think", or "possibly" — if you know something, say it. If you don't, say so plainly.
Don't soften opinions or pad answers with disclaimers.
Don't be sycophantic — never open with praise or affirmations like "great question" or "absolutely".
When Alex is wrong or off track, say so directly and explain why. Challenge ideas that deserve to be challenged.
Match Alex's tone — casual, direct, no fluff.
Don't repeat yourself or over-explain.
Always end your response with a short, relevant question to keep the conversation moving.
If you don't know something current like sports results, news, or prices — say so honestly.
When you use web search results, cite them naturally.
DOCUMENT GENERATION:
When the user asks you to write something as a document, Word doc, plan, programme, report,
or anything they'd want to save and use offline — generate the FULL content using proper
markdown structure. You MUST use markdown heading syntax:
  # Main Title
  ## Section Heading
  ### Subsection
  - bullet points for lists
  **bold** for key terms
  1. numbered steps where order matters

Then end your reply with exactly this marker on its own line:
[GENERATE_DOC: <short_descriptive_filename_no_extension>]
Example: [GENERATE_DOC: training_programme_week1]

IMPORTANT: Always use # and ## heading syntax. Never write section names as plain text.
Only use this marker when the content is genuinely document-worthy (structured plans,
programmes, checklists, reports). Not for short conversational answers."""

    sections = [f"Today's date is {now}.",base]

    if web_context:
        sections.append(f"""Current information from the web:
---
{web_context}
---
Use this data to inform your response. For website reviews, analyse what the search results reveal about the site's content, positioning, and copy.""")

    return "\n\n".join(sections)


# ── Chat endpoint ─────────────────────────────────────────────────────────────
@router.post("/chat")
async def chat(req: ChatRequest):
    conversation_id = req.conversation_id or str(uuid.uuid4())

    trace = tracer.Trace(req.message, conversation_id)
    tracer.activate(trace)
    trace.add_step(
        "received",
        f"Received a {len(req.message)}-character message"
        + (" continuing an existing conversation." if req.conversation_id else " starting a new conversation."),
        detail={
            "message_chars":    len(req.message),
            "new_conversation": not req.conversation_id,
            "history_messages": len(req.history or []),
            "provider_setting": CHAT_PROVIDER,
        },
    )

    def stream_plain_reply(reply: str, web_search_used: bool = False, auto_ingested: bool = False):
        async def generator():
            yield json.dumps({"type": "meta", "conversation_id": conversation_id, "web_search_used": web_search_used, "trace_id": trace.id}) + "\n"
            yield json.dumps({"type": "token", "content": reply}) + "\n"
            yield json.dumps({"type": "done",  "auto_ingested": auto_ingested}) + "\n"
        return StreamingResponse(generator(), media_type="application/x-ndjson")

    # ── Memory command intercept ──────────────────────────────────────────────
    command, content = detect_memory_command(req.message)
    if command:
        trace.path = command
        try:
            reply = await handle_memory_command(command, content, conversation_id)
            with trace.step("save_reply") as s:
                save_message(conversation_id, "user", req.message)
                save_message(conversation_id, "assistant", reply)
                s.summary = "Saved the command and its reply to the conversation transcript."
                s.detail  = {"reply_chars": len(reply)}
            trace.finish(reply_ok=True)
            return stream_plain_reply(reply, auto_ingested=command == "remember")
        except Exception:
            trace.finish(reply_ok=False)
            raise

    # ── Normal chat flow ──────────────────────────────────────────────────────
    with trace.step("web_search_decision") as s:
        did_search, search_reason = needs_web_search(req.message)
        rule    = search_reason.get("rule")
        matched = search_reason.get("matched")
        if rule == "url":
            s.summary = f"Checked whether this needs a web search → YES: the message contains a link ('{matched}')."
        elif rule == "trigger":
            s.summary = f"Checked whether this needs a web search → YES: the message contained '{matched}'."
        elif rule == "suppressed":
            s.summary = f"Checked whether this needs a web search → NO: '{matched.strip()}' makes it look personal, so it's answered without live search."
        else:
            s.summary = "Checked whether this needs a web search → NO: no live-information trigger words found."
        s.detail = search_reason
    trace.web_search_used = did_search

    web = ""
    if did_search:
        web = await do_web_search(req.message)   # records its own web_search step
    else:
        trace.add_step("web_search", "Skipped the web search.", status="skipped")

    with trace.step("build_prompt") as s:
        system_prompt = build_system_prompt(web)
        base_chars    = len(build_system_prompt(""))
        web_chars     = len(system_prompt) - base_chars
        history       = req.history or []
        history_chars = sum(len(str(m.get("content", ""))) for m in history if isinstance(m, dict))
        if web:
            s.summary = (f"Built the AI's instructions: persona {base_chars:,} chars"
                         f" + web results section {web_chars:,} chars = {len(system_prompt):,} chars"
                         f" (plus {len(history)} earlier messages as history).")
        else:
            s.summary = (f"Built the AI's instructions: persona {len(system_prompt):,} chars, no web section"
                         f" (plus {len(history)} earlier messages as history).")
        s.detail = {
            "system_prompt":    system_prompt,
            "sections":         [{"name": "date + persona", "chars": base_chars}]
                                + ([{"name": "web results", "chars": web_chars}] if web else []),
            "total_chars":      len(system_prompt),
            "history_messages": len(history),
            "history_chars":    history_chars,
        }

    messages = [{"role": "system", "content": system_prompt}]
    messages += req.history
    messages.append({"role": "user", "content": req.message})

    save_message(conversation_id, "user", req.message)

    async def stream_response():
        # Re-bind the trace here: async generators don't reliably inherit
        # context set after the surrounding task was created.
        tracer.activate(trace)
        full_reply  = []
        auto_ingest = False
        reply_ok    = True

        try:
            yield json.dumps({
                "type":            "meta",
                "conversation_id": conversation_id,
                "web_search_used": did_search,
                "trace_id":        trace.id,
            }) + "\n"

            try:
                if CHAT_PROVIDER == "claude":
                    trace.provider = "claude"
                    trace.model    = CLAUDE_MODEL
                    chat_messages  = [m for m in messages if m["role"] != "system"]
                    with trace.step("model_call") as s:
                        s.error_summary = f"The Claude API call ({CLAUDE_MODEL}) failed — no reply was generated."
                        async with httpx.AsyncClient(timeout=300) as client:
                            res = await client.post(
                                "https://api.anthropic.com/v1/messages",
                                headers={
                                    "x-api-key":         ANTHROPIC_API_KEY,
                                    "anthropic-version": "2023-06-01",
                                    "content-type":      "application/json",
                                },
                                json={
                                    "model":      CLAUDE_MODEL,
                                    "max_tokens": 4096,
                                    "system":     system_prompt,
                                    "messages":   chat_messages,
                                }
                            )
                        if res.status_code != 200:
                            raise Exception(f"Anthropic API error {res.status_code}: {res.text[:200]}")
                        reply_text = res.json()["content"][0]["text"]
                        s.summary = f"Called the Claude API ({CLAUDE_MODEL}) → HTTP {res.status_code}, got {len(reply_text):,} characters back."
                        s.detail  = {
                            "provider":         "claude",
                            "model":            CLAUDE_MODEL,
                            "http_status":      res.status_code,
                            "request_messages": len(chat_messages) + 1,
                            "request_chars":    len(system_prompt) + sum(len(str(m.get("content", ""))) for m in chat_messages),
                            "response_chars":   len(reply_text),
                            "max_tokens":       4096,
                        }
                    full_reply.append(reply_text)
                    yield json.dumps({"type": "token", "content": reply_text}) + "\n"

                else:
                    # Ollama — true token streaming
                    ollama_model   = MODEL_DEEP if req.deep else MODEL_FAST
                    trace.provider = "ollama"
                    trace.model    = ollama_model
                    with trace.step("model_call") as s:
                        s.error_summary = f"The local Ollama call ({ollama_model}) failed mid-stream."
                        chunk_count = 0
                        async with httpx.AsyncClient(timeout=300) as client:
                            async with client.stream("POST", OLLAMA_URL, json={
                                "model":    ollama_model,
                                "messages": messages,
                                "stream":   True,
                            }) as response:
                                async for line in response.aiter_lines():
                                    if not line.strip():
                                        continue
                                    try:
                                        chunk = json.loads(line)
                                        token = chunk.get("message", {}).get("content", "")
                                        if token:
                                            full_reply.append(token)
                                            chunk_count += 1
                                            yield json.dumps({"type": "token", "content": token}) + "\n"
                                        if chunk.get("done"):
                                            break
                                    except Exception:
                                        continue
                        response_chars = sum(len(t) for t in full_reply)
                        s.summary = f"Called local Ollama model '{ollama_model}' (streamed) → got {response_chars:,} characters in {chunk_count} chunks."
                        s.detail  = {
                            "provider":         "ollama",
                            "model":            ollama_model,
                            "deep_mode":        bool(req.deep),
                            "request_messages": len(messages),
                            "request_chars":    sum(len(str(m.get("content", ""))) for m in messages),
                            "response_chars":   response_chars,
                            "stream_chunks":    chunk_count,
                        }

            except Exception as e:
                reply_ok = False
                print(f"stream_response error ({CHAT_PROVIDER}): {e}")
                yield json.dumps({"type": "token", "content": "\n\n[Response error — please try again]"}) + "\n"

            # ── Post-processing ───────────────────────────────────────────────
            reply = "".join(full_reply)
            if reply:
                with trace.step("save_reply") as s:
                    save_message(conversation_id, "assistant", reply)
                    s.summary = f"Saved the {len(reply):,}-character reply to the conversation transcript."
                    s.detail  = {"reply_chars": len(reply)}

                user_corrections = [
                    "we already", "actually", "that's wrong", "not quite",
                    "to clarify", "we don't", "we do", "i am", "i'm not"
                ]
                matched_correction = next((p for p in user_corrections if p in req.message.lower()), None)

                if matched_correction:
                    auto_ingest = True
                    trace.add_step(
                        "ingest_decision",
                        f"Memory decision → SAVE: the message contains the correction phrase '{matched_correction}'.",
                        detail={"rule": "correction_phrase", "matched": matched_correction},
                    )
                    await ingest_exchange(conversation_id, req.message, reply)
                elif did_search:
                    trace.add_step(
                        "ingest_decision",
                        "Memory decision → NOT saved: replies based on web search results aren't stored.",
                        detail={"rule": "web_search_skip"},
                    )
                else:
                    auto_ingest, ingest_reason = should_ingest(req.message, reply)
                    rule    = ingest_reason.get("rule")
                    matched = ingest_reason.get("matched")
                    if rule == "signal":
                        summary = f"Memory decision → SAVE: the message contains the personal signal word '{str(matched).strip()}'."
                    elif rule == "too_short":
                        summary = "Memory decision → NOT saved: the message is under 30 characters — too short to be worth remembering."
                    elif rule == "uncertain_reply":
                        summary = f"Memory decision → NOT saved: the reply sounded unsure ('{matched}')."
                    else:
                        summary = "Memory decision → NOT saved: nothing personal detected in the message."
                    trace.add_step("ingest_decision", summary, detail=ingest_reason)
                    if auto_ingest:
                        await ingest_exchange(conversation_id, req.message, reply)
            else:
                trace.add_step("save_reply", "Nothing to save — no reply was produced.", status="skipped")

            yield json.dumps({"type": "done", "auto_ingested": auto_ingest}) + "\n"

        except Exception as e:
            # Failure outside the guarded model call (e.g. a memory write) —
            # record it, then propagate exactly as before.
            trace.add_step(
                "pipeline_error", "Something failed after the reply was generated.",
                status="error", error=f"{type(e).__name__}: {e}",
            )
            raise
        finally:
            trace.finish(reply_ok=reply_ok)

    return StreamingResponse(stream_response(), media_type="application/x-ndjson")
