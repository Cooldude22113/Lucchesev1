# Where I left off

**Overwrite this file — don't append.** It answers one question: if I sat down
right now, what would I need to know? Last thing each session: update it.
First thing next session: read it.

Last updated: 13 August 2026 · at commit `da54368`

---

## Right now

Nothing in progress. The repo is clean. Tracing is finished and signed off —
checked in the browser, and it's already tracing real messages on the live
backend. Good moment to start something new.

## Recently finished

- **Repo audit** (`AUDIT.md`) — every file classified used / unused /
  half-finished / dev-only, with two diagrams of how the app fits together.
  Still broadly accurate; the business-code sections are now out of date.
- **Removed all PTPreps business code** — Shopify integration
  (`shopify.py`, `shopify_api.py`), the Google Sheets menu layer (`sheets.py`,
  which used to be hit on *every* chat message), the meal/macro/allergen
  rules in the system prompt, and the business persona. Alex left the
  business, so none of it applies any more.
- **Per-message tracing** (commit `2392201`) — every `POST /chat` now records
  a step-by-step trace: which path it took and why, whether web search fired
  and which word triggered it, the assembled prompt, which model was called,
  how long each step took, and swallowed errors. Readable lines print to the
  backend terminal; the full record goes to a `traces` table (newest 500 kept)
  and is browsable in the admin **Debug** tab. Verified on all five paths
  including a real Ollama timeout, which showed up as an error step with the
  reply still delivered — exactly the intended behaviour.
- **Refreshed `AUDIT.md`** — it predated both the business-code removal and
  tracing, so a third of it described code that no longer existed. Rewritten
  against current code, with a "what changed since the last audit" table at
  the end.
- **Deleted `.claude/agents/`** — stale Claude Code config pointing at files
  that no longer existed.

## Next up — in priority order

1. **Wire memory reading into chat.** The biggest real gap: `search_memory()`
   in `routes/memory.py` is fully built but has **zero callers and zero
   imports** — `chat.py` stopped importing it in `da54368`. Lucchese saves
   memories it can never recall — ask it "what have I told you about X" and it
   answers from the current conversation only. Fix: call
   `search_memory(req.message)` in the normal chat flow and add the results as
   a section in `build_system_prompt()`. Watch latency — it does an Ollama
   query-expansion call plus a rerank; skip `expand_query` if slow. Wrap it in
   a trace step and the Debug tab will show exactly what it retrieved and what
   it cost, per message.
2. **Delete the remaining dead code** that `AUDIT.md` lists and the cleanup
   missed: `routes/scrape.py` (mounted nowhere, no callers), the
   `roleplay_sessions` table + helpers in `database.py`, `chroma_client.py`
   and `check_chroma.py` (they target a Chroma server that isn't run),
   `frontend/src/App.css`, the unused `assets/`, `public/icons.svg`, and
   `encodeWAV` in `App.jsx`.
3. **Fix the exposed admin key.** `VITE_ADMIN_KEY` is baked into the public JS
   bundle, so anyone visiting the site can extract it and call the
   delete-memory endpoint. Either keep the admin page local-only or move to a
   real login the backend checks per request.
4. Smaller: `Home.jsx` hardcodes the production API URL; the browser tab still
   says "frontend"; `claude-sonnet-4-6` should come from `.env` rather than
   the `CLAUDE_MODEL` constant; the Claude path doesn't really stream.

## Watch out for

- `/voice-chat` runs its own untraced copy of the chat pipeline and is
  drifting from `chat.py` — it misses tracing and hardcodes the model name.
  Worth merging onto one shared path before the two diverge further.
- `backend/raw/conversations_export.json` and `raw/extracted_user_messages/`
  are real conversation exports **committed to git**. Fine while the repo is
  private; `git rm --cached` them before it's ever shared.
- `start.bat` hardcodes `C:\LuccheseOld\` paths.
