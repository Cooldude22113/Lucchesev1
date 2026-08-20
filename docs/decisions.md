# Decisions

Why things are the way they are. The code shows *what*; this shows *why*, so
old arguments don't get re-litigated every few weeks.

One entry per real decision. Newest at the top. Keep them short.

---

## 2026-08 — Chat UI rebuilt from the Claude Design doc, direction 2b

The redesign doc (`Lucchese Chat.dc.html`, project *Lucchese chat redesign*)
offered two paths: **2a** sharpened today's layout, **2b** re-architected the
reading experience. We took 2b, plus its states 2c–2i.

The argument for 2b: the real complaint wasn't that the old screen was ugly,
it was that a 400-word reply arrived as one undifferentiated wall capped at
70% width. 2b lets the assistant bubble grow into the column and breaks long
replies with hairline rules and Playfair section heads, so an answer scans in
sections. 2a would have left that problem in place.

Three Vite-template quirks in `index.css` were deliberately removed rather
than designed around, because the design measures against a clean shell: the
1126px `#root` cap with a border down each side, the inherited
`text-align:center`, and `code { display:inline-flex }` — which turned every
fenced block into one unwrappable chip that spilled past the bubble.

Deliberately *not* done: the design's eight-second hands-free send is wired to
the existing `Voice.jsx` timer, not to real silence detection. There is no VAD
in this codebase and adding one is a separate piece of work.

## 2026-08 — Removed all PTPreps business code

Alex left the meal-prep business, so everything built for it went: the Shopify
product-creation integration, the Google Sheets menu/macro/allergen layer, and
the business persona in the system prompt.

Worth knowing: the Sheets layer made two live API calls on **every single chat
message**, food-related or not, and `sheets.py` connected at import time — a
missing `credentials.json` stopped the whole backend from booting. Removing it
made the app faster and removed a hard external dependency from startup.

Lucchese is now a general personal AI, not a business tool.

## 2026-08 — Traces go to SQLite, not just the log file

Per-message traces are stored in a `traces` table alongside the chat
transcripts, not only written to `lucchese.context.log`.

Log files can't be queried, don't survive well, and can't back a UI. SQLite was
already there for conversations, so the traces table was nearly free and gives
the admin Debug tab something to page through. Retention is capped at the
newest 500 traces, pruned on every write, so it can't grow forever.

## 2026-08 — Tracing is exception-guarded everywhere

Every method on `Trace` is wrapped in try/except, and `tracer.current()`
returns a no-op object when no trace is active.

The rule: **a bug in the debugging tool must never break a chat reply.**
Instrumenting a function must not change its signature, its return value, or
how it fails. That's also why `memory.py` reaches for the active trace via
`tracer.current()` rather than taking a trace parameter — its function
signatures stayed untouched.

## 2026-08 — Reused the `lucchese.context` logger instead of adding a second one

An earlier abandoned effort had already configured a logger called
`lucchese.context` (console + 5 MB rotating file) that nothing ever wrote to.
Rather than leave it as dead scaffolding and add a parallel logging setup, the
tracer writes to it. One logging path, not two.

## 2026-08 — Deleted `.claude/agents/`

Those five files told Claude Code to route all work through a "core"
coordinator and specialist sub-agents for `state.py` and `context_builder.py`
— files that were deleted in the July refactor or never existed. Stale config
that made sessions worse, not better.

## 2026-07 — Chat provider is a switch, not a rewrite

`CHAT_PROVIDER` in `.env` picks Anthropic or local Ollama at runtime, and both
paths are kept working in `chat.py`. Currently set to `claude`.

Ollama still earns its place for background jobs (classifying "remember"
facts, the admin Summarise button) where latency doesn't matter and API cost
does. Keeping the switch means falling back offline is a one-line change.

Trade-off accepted: the Claude path doesn't stream — it waits for the whole
reply and sends it in one chunk, and the frontend fakes the typing effect.
Only the Ollama path streams token by token.
