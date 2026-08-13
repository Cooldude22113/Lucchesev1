# Lucchese — project brief

Read this first, then read `STATE.md` for where work left off.

## What this is

Lucchese is Alex Hammond's personal AI assistant. Web chat UI + voice mode,
backed by a Python API that calls Claude (or a local model), remembers things
in a vector database, reads uploaded documents, and can generate Word docs.

Single-user, self-hosted: it runs on Alex's own PC and is exposed to
`lucchese.app` through a Cloudflare tunnel. There are no other users, no
auth on the chat itself, and no test suite.

## Stack

| Layer | What |
|---|---|
| Frontend | React + Vite, plain JS (no TypeScript), inline styles. `frontend/` |
| Backend | Python FastAPI, uvicorn on port 8000. `backend/` |
| Chat model | Anthropic API (`claude-sonnet-4-6`) or local Ollama — switched by `CHAT_PROVIDER` in `backend/.env` |
| Memory | ChromaDB, embedded (files in `backend/chroma_db/`) — stores "memories" searchable by meaning |
| Transcripts | SQLite (`backend/conversations.db`) — literal chat history + traces |
| Voice | Whisper (local, speech→text) + ElevenLabs (text→speech) |
| Web search | DuckDuckGo via `ddgs` |

## Running it

`start.bat` launches everything on Windows: Ollama, the backend, the Vite dev
server, and the Cloudflare tunnel. Note it hardcodes `C:\LuccheseOld\` paths.

Manually:
```
cd backend && venv\Scripts\activate && uvicorn main:app --reload --port 8000
cd frontend && npm run dev          # port 5173
```

Secrets live in `backend/.env` (gitignored): `ANTHROPIC_API_KEY`,
`CHAT_PROVIDER`, `ADMIN_API_KEY`, `ELEVENLABS_*`, `OLLAMA_BASE_URL`,
`MODEL_FAST`. Frontend reads `VITE_API_URL` and `VITE_ADMIN_KEY`.

## What happens on a chat message

`POST /chat` in `backend/routes/chat.py` is the heart of the app:

1. A **trace** is opened (`routes/tracer.py`) — every step below gets recorded.
2. **Memory command check** — "remember that…" / "forget…" short-circuit to
   `handle_memory_command` and return early.
3. **Web search decision** — `needs_web_search()` returns `(bool, reason)`.
   A URL forces yes; personal signals ("my ", "i'm") suppress; trigger words
   ("latest", "news", "score"…) force yes.
4. **System prompt** built by `build_system_prompt(web_context)` — persona +
   today's date + web results if any.
5. **Model call** — Anthropic (whole reply at once) or Ollama (true token
   streaming), per `CHAT_PROVIDER`.
6. **Save + maybe ingest** — transcript to SQLite; if the message looks
   personal or corrective, the exchange is written to ChromaDB memory.
7. Reply streams to the browser as **NDJSON** — one JSON object per line,
   `{"type":"meta"|"token"|"done"}`. `meta` carries `trace_id`.

## Key files

```
backend/
  main.py              app entry: CORS, logger config, router mounting
  routes/chat.py       POST /chat — the pipeline above
  routes/tracer.py     Trace class; every method is exception-guarded
  routes/traces.py     GET /admin/traces[/{id}] for the Debug tab
  routes/memory.py     all ChromaDB work: ingest, classify, search, rerank
  routes/database.py   SQLite: conversations, messages, documents, traces
  routes/config.py     env vars, ElevenLabs client, Whisper model, admin auth
  routes/voice.py      /transcribe, /tts, /voice-chat
  routes/files.py      upload, documents, Word-doc generation
  routes/admin.py      /admin/* memory dashboard endpoints
frontend/src/
  App.jsx              chat UI, routing, docs panel, mic/voice mode
  AdminPanel.jsx       memory dashboard + Debug (trace) tab
  Home.jsx             dashboard;  Voice.jsx  tap-to-talk page
```

`AUDIT.md` in this repo is a full used/unused/half-finished map of every file,
regenerated 13 August 2026 against current code — trust the code over it if
they differ.

## Conventions

- **Admin endpoints** live under `/admin/*`, depend on `verify_admin_key`
  (`routes/config.py`), and the frontend sends the `X-Admin-Key` header.
- **Tracing must never break a reply.** Everything in `tracer.py` is wrapped;
  `tracer.current()` returns a no-op object when no trace is active, so
  instrumenting a function never changes its signature or failure behaviour.
- **Don't break NDJSON streaming** — the frontend parses line by line.
- Route files own their endpoints and are mounted in `main.py`. Files without
  endpoints (`memory.py`, `database.py`, `documents.py`) are libraries.
- Python: 4-space indent, section banners (`# ── Name ──…`), type hints on new
  functions. No formatter or linter is enforced on the backend.

## Known gaps — read before "fixing" something that looks broken

- **Memory is written but never read.** `search_memory()` in `memory.py` is
  fully built (query expansion, cross-encoder reranking, recency bonus) but has
  zero callers and zero imports. Replies never see stored memories, and the
  cross-encoder is loaded at every startup for nothing. Top open item; see
  `STATE.md`.
- **`/voice-chat` is not traced.** It runs its own copy of the chat pipeline
  (`voice.py`) — own prompt build, own model call, own ingest decision — so
  spoken messages never appear in the Debug tab.
- `routes/scrape.py` exists but is mounted nowhere and has no caller — dead.
- `roleplay_sessions` table and its helpers in `database.py` belong to a
  deleted feature.
- `VITE_ADMIN_KEY` is compiled into the public JS bundle — anyone loading the
  site can read the admin key. Known, not yet fixed.
- `Home.jsx` hardcodes the production API URL instead of using `VITE_API_URL`.
- The Claude path does **not** stream; the whole reply arrives at once and the
  frontend fakes the typing effect. Only Ollama truly streams.

## Working agreements

- **Commit small and often** — one finished thing per commit, with a message
  that says what changed and why. History is the project's memory.
- **Update `STATE.md`** at the end of a work session: what got done, what's
  next, anything left half-finished.
- **Record real decisions** in `docs/decisions.md` — why, not what.
- Use plan mode for anything non-trivial; agree the plan before editing.
