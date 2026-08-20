# Where I left off

**Overwrite this file — don't append.** It answers one question: if I sat down
right now, what would I need to know? Last thing each session: update it.
First thing next session: read it.

Last updated: 20 August 2026

---

## Right now

The chat UI has just been rebuilt from the Claude Design doc. It lints clean,
builds clean, and every screen has been checked in a real browser against the
artboards — but it has **not been used against the live backend yet**. That's
the first thing to do next session: run `start.bat`, send a few real messages,
and watch the streaming, voice and Word-doc paths with actual data.

## Recently finished

- **Chat redesign, direction 2b** — `frontend/src/App.jsx` rewritten against
  `Lucchese Chat.dc.html` (Claude Design project *Lucchese chat redesign*).
  What changed:
  - **Replies read as articles.** The assistant bubble grows into an 860px
    column instead of stopping at 70%; markdown headings become Playfair
    section heads with a hairline rule above, so a long answer scans in
    sections. Lists get a gold em-dash marker.
  - **Fenced code is a framed panel** with a language label and a COPY
    button, instead of the single spilling chip it used to be.
  - **Sidebar** groups conversations into Today / Yesterday / Earlier with
    relative times ("2 minutes ago", "This morning"), a gold active bar, and
    a document count on the Documents button.
  - **Empty state** replaces the canned "Good to see you" bubble with the
    greeting screen — time-of-day greeting, date, and live counts
    (conversations · documents · memories).
  - **One voice strip, three states** (listening / thinking / speaking) docked
    between transcript and composer, so it never moves. Bars are driven by the
    real mic analyser through a single `--lu-gain` CSS variable. On mobile it
    replaces the composer.
  - **Word-doc offer** is now a footer card on the reply carrying the
    document's own title, with all four states (idle / generating / ready /
    failed) in the same block so nothing reflows.
  - **Mobile**: sidebar becomes a drawer, buttons are 44px, the SHIFT+ENTER
    hint is dropped.
  - New behaviour, small: **ESC** stops a reply (real `AbortController`, not
    just a spinner), the send button becomes a stop button, and in voice mode
    a spoken turn auto-sends and carries a mic mark in the thread.
- **Cleared three Vite-template quirks** in `index.css` that the design
  measured against: the 1126px `#root` cap with side borders, the inherited
  `text-align:center`, and `code { display:inline-flex }`. Also set the
  browser tab title to "Lucchese" and preloaded the two fonts in
  `index.html` rather than `@import`-ing them mid-render.
- **Per-message tracing** (commit `2392201`) — every `POST /chat` records a
  step-by-step trace, browsable in the admin **Debug** tab. Verified on all
  five paths.
- **Repo audit** (`AUDIT.md`), **removal of all PTPreps business code**, and
  **deletion of `.claude/agents/`** — see `docs/decisions.md`.

## Next up — in priority order

1. **Run the redesign against the live backend.** Everything below was checked
   with a mocked API. Worth watching specifically: the streaming caret on a
   real Claude reply (which arrives all at once), whether `/admin/stats`
   answers for the memory count on the empty state, and the voice round trip.
2. **Wire memory reading into chat.** Still the biggest real gap:
   `search_memory()` in `routes/memory.py` is fully built but has **zero
   callers and zero imports**. Lucchese saves memories it can never recall.
   Fix: call `search_memory(req.message)` in the normal chat flow and add the
   results as a section in `build_system_prompt()`. Watch latency — it does an
   Ollama query-expansion call plus a rerank; skip `expand_query` if slow.
   Wrap it in a trace step so the Debug tab shows what it retrieved and cost.
3. **Delete the remaining dead code** that `AUDIT.md` lists: `routes/scrape.py`
   (mounted nowhere), the `roleplay_sessions` table + helpers in
   `database.py`, `chroma_client.py` and `check_chroma.py` (they target a
   Chroma server that isn't run), `frontend/src/App.css` (imported nowhere,
   pure Vite template), the unused `assets/`, and `public/icons.svg`.
   `encodeWAV` in `App.jsx` is already gone with the rewrite.
4. **Fix the exposed admin key.** `VITE_ADMIN_KEY` is baked into the public JS
   bundle, so anyone visiting the site can extract it and call the
   delete-memory endpoint. The new empty state reads `/admin/stats` with it
   too, so this now leaks on the chat page as well as `/admin` and `/`.
   Either keep the admin surface local-only or move to a real login the
   backend checks per request.
5. Smaller: `Home.jsx` hardcodes the production API URL; `claude-sonnet-4-6`
   should come from `.env` rather than the `CLAUDE_MODEL` constant.

## Watch out for

- **`Home.jsx` and `AdminPanel.jsx` were not redesigned.** They still carry the
  old look, and they now render without the `#root` centring they were written
  under — worth a look before deciding whether to bring them onto the new
  design or leave them.
- **The eight-second hands-free send is a timer, not silence detection.** It
  matches what `Voice.jsx` already did. Real VAD is separate work.
- `/voice-chat` runs its own untraced copy of the chat pipeline and is drifting
  from `chat.py` — it misses tracing and hardcodes the model name. It also now
  misses the whole redesigned voice strip, since that lives in `App.jsx`.
- `backend/raw/conversations_export.json` and `raw/extracted_user_messages/`
  are real conversation exports **committed to git**. Fine while the repo is
  private; `git rm --cached` them before it's ever shared.
- `start.bat` hardcodes `C:\LuccheseOld\` paths.
