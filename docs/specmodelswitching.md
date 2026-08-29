# Model switching + settings page

## Context

Lucchese picks its model from a global env var (`CHAT_PROVIDER`) and two
hardcoded constants (`CLAUDE_MODEL = "claude-sonnet-4-6"` in `chat.py`,
`MODEL_FAST`/`MODEL_DEEP` in `config.py`). Changing model means editing code
or `.env` and restarting.

Alex wants two things instead:

1. **A model picker on the chat page** — choose per conversation between
   Claude models, Ollama models, fine-tunes, and eventually the model he's
   training himself.
2. **A settings page** — free-text instructions that shape how Lucchese
   behaves ("act like X"), editable at runtime rather than living in code.

Automatic topic-based routing is explicitly **out of scope** — judged
unrealistic for now. This is manual selection only.

The organising principle: **agree the API contract first**, then build
backend, then frontend. Backend and frontend are not parallel work here —
the picker cannot exist until something lists the models.

---

## The API contract (build to this on both sides)

```
GET /models
→ { "default": "claude-sonnet-4-6",
    "models": [
      { "id": "claude-sonnet-4-6", "label": "Claude Sonnet 4.6",
        "provider": "anthropic", "model": "claude-sonnet-4-6",
        "streams": false, "available": true },
      { "id": "gemma2-27b", "label": "Gemma 2 27B (local)",
        "provider": "ollama", "model": "gemma2:27b",
        "streams": true, "available": true },
      { "id": "lucchese-v1", "label": "Lucchese v1 (mine)",
        "provider": "ollama", "model": "lucchese-v1:latest",
        "streams": true, "available": false }
    ] }

GET /settings          → { "default_model": "...", "persona": "...",
                           "max_tokens": 4096 }
PUT /settings          body: any subset of the above → updated settings

POST /chat             body gains optional "model": "<id>"
                       (omitted → settings.default_model)
NDJSON "meta" event gains "model" and "provider" so the UI can show what
actually answered.
```

`id` is a stable slug — never the raw Ollama name, which contains colons and
changes between pulls. `streams` matters: the Anthropic path returns the whole
reply at once while Ollama streams token by token, so the UI must know which
behaviour to expect rather than faking it uniformly.

---

## Backend

### 1. Model registry — `backend/routes/models.py` (new)

- A static list of known models (Anthropic ones, plus any Ollama models worth
  naming) as module-level config.
- **Live Ollama discovery**: call Ollama's `GET /api/tags` to list what is
  actually installed, and merge. This is what makes Alex's own model appear
  in the picker automatically once he pulls it into Ollama — no code change.
- `available` reflects reality: Anthropic models are available if
  `ANTHROPIC_API_KEY` is set; Ollama models are available if discovery found
  them. Discovery failure (Ollama not running) must degrade to "Ollama models
  unavailable", never raise.
- Exposes `GET /models`, mounted in `main.py` like every other router.
- `resolve(model_id)` → the registry entry, used by chat.

### 2. Settings store — extend `backend/routes/database.py`

- New `settings` table, simple key/value text — mirrors the existing
  `init_db()` pattern and the `save_trace`/`get_trace` helper style.
- `get_settings()` / `update_settings(dict)`.
- Seed on first run: `default_model` from the current `CHAT_PROVIDER`
  behaviour, `persona` seeded from **`docs/character.md`**'s prompt block,
  `max_tokens` 4096 (currently hardcoded at `chat.py:293`).
- `docs/character.md` stays the versioned *default*; the DB holds the live
  value. Note this in `docs/decisions.md` — it is a real decision.

### 3. Settings endpoints — `backend/routes/settings.py` (new)

`GET /settings` and `PUT /settings`. Follow the existing admin pattern
(`verify_admin_key` from `routes/config.py`) — but see the caveat below.

### 4. Provider dispatch — `backend/routes/chat.py`

- `ChatRequest` gains `model: Optional[str] = None`.
- Resolve once near the top: request model → settings default → registry
  fallback. Record it on the trace (`trace.provider`, `trace.model` already
  exist and are currently set from the `CLAUDE_MODEL` constant).
- Replace the `if CHAT_PROVIDER == "claude"` branch with a dispatch on the
  resolved entry's `provider`. Extract the two inline HTTP calls into
  functions — this is the first real step of the endpoint/logic/client
  layering discussed previously, arriving where it's needed rather than as a
  big-bang refactor.
- `build_system_prompt()` takes the persona from settings instead of the
  hardcoded base string.
- Unavailable model → a clear error in the reply stream and an error step in
  the trace, never a 500.
- Emit `model`/`provider` in the `meta` NDJSON event.
- Delete the unused `deep` flag, or repurpose it — the frontend never sends it.

### 5. Don't forget `voice.py`

`/voice-chat` runs its own copy of the pipeline with its own hardcoded model.
It must use the same resolution, or spoken messages will silently ignore the
picker. Either route it through the shared dispatch or explicitly defer it and
note that in `STATE.md`.

---

## Frontend

### 1. Model picker — `frontend/src/App.jsx`

- Fetch `GET /models` on load; render a picker in the composer area.
- Show unavailable models greyed with the reason, rather than hiding them —
  "Lucchese v1 — not loaded in Ollama" is more useful than absence.
- Selection persists per conversation (localStorage is fine) and is sent as
  `model` on each `POST /chat`.
- Show which model produced each reply, from the `meta` event. This matters
  more than usual here: comparing models is the point of the feature.

### 2. Settings page — `frontend/src/Settings.jsx` (new)

- New route alongside the existing ones in `App.jsx`.
- Fields: default model, persona instructions (large textarea), max tokens.
- `GET /settings` on mount, `PUT /settings` on save, with saved/failed states.
- Match the redesigned chat aesthetic — near-black `#0a0a0a`, gold `#c8a96e`,
  Playfair headings, DM Sans body.

---

## Phases

1. **Registry + `GET /models`.** Verify in a browser: correct list, Ollama
   models discovered, sane output with Ollama stopped.
2. **Settings table + endpoints.** Verify with curl; confirm seeding works and
   survives a restart.
3. **Chat dispatch.** Model selection honoured, persona from settings, trace
   shows the right model. Verify in the Debug tab.
4. **Model picker UI.**
5. **Settings page UI.**

Each phase is one commit and leaves the app working.

---

## Caveat worth deciding before step 2

`VITE_ADMIN_KEY` is already baked into the public JS bundle, so anything
behind `verify_admin_key` is effectively public to anyone loading the site.
Putting the persona and default model behind that key adds *writable* config
to that exposure — someone could rewrite Lucchese's instructions.

Options: accept it (single user, obscure URL), keep settings local-only, or
fix the auth first. It's listed as item 4 in `STATE.md`. Decide deliberately
rather than by default.

---

## Verification

No test suite. Manual click-through after phases 3–5:

1. Send a message on the default model → correct reply, Debug tab shows that
   model.
2. Switch to an Ollama model → reply streams token by token; Debug tab shows
   the Ollama provider.
3. Switch to Claude → reply arrives whole; trace shows the Anthropic call.
4. Stop Ollama, reload → Ollama models show unavailable; selecting one gives a
   clear error, not a crash.
5. Change the persona in settings, save, reload, send a message → new persona
   is visible in the reply and in the trace's system-prompt step.
6. Restart the backend → settings persisted.
7. Voice mode → confirm it uses the selected model, or that it is knowingly
   still on the old path.
