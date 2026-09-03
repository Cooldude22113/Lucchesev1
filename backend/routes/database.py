"""
database.py
All SQLite database operations for Lucchese.
Handles: schema init, conversations, messages, documents, traces, settings,
and the owner timeline.
"""

import os
import json
import sqlite3
import uuid
from datetime import datetime, timezone

# ── Config ────────────────────────────────────────────────────────────────────
DB_PATH = "./conversations.db"


# ── Schema setup ──────────────────────────────────────────────────────────────
def init_db():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id          TEXT PRIMARY KEY,
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL,
            title       TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id              TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role            TEXT NOT NULL,
            content         TEXT NOT NULL,
            created_at      TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id          TEXT PRIMARY KEY,
            filename    TEXT NOT NULL,
            file_type   TEXT NOT NULL,
            chunk_count INTEGER NOT NULL,
            created_at  TEXT NOT NULL
        )
    """)
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_messages_conv_id ON messages(conversation_id)"
    )
    cur.execute("""
        CREATE TABLE IF NOT EXISTS roleplay_sessions (
            conversation_id TEXT PRIMARY KEY,
            exchanges       INTEGER NOT NULL DEFAULT 0,
            created_at      TEXT NOT NULL
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS traces (
            id              TEXT PRIMARY KEY,
            conversation_id TEXT,
            created_at      TEXT NOT NULL,
            user_message    TEXT,
            path            TEXT,
            provider        TEXT,
            model           TEXT,
            web_search_used INTEGER NOT NULL DEFAULT 0,
            status          TEXT,
            duration_ms     INTEGER,
            steps_json      TEXT
        )
    """)
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_traces_created ON traces(created_at)"
    )
    cur.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key        TEXT PRIMARY KEY,
            value      TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS timeline (
            id          TEXT PRIMARY KEY,
            title       TEXT NOT NULL,
            body        TEXT NOT NULL DEFAULT '',
            notes       TEXT NOT NULL DEFAULT '',
            phase       TEXT NOT NULL DEFAULT '',
            status      TEXT NOT NULL DEFAULT 'idea',
            occurred_at TEXT,
            position    INTEGER NOT NULL DEFAULT 0,
            refs_json   TEXT NOT NULL DEFAULT '[]',
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        )
    """)
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_timeline_position ON timeline(position)"
    )
    con.commit()
    con.close()
    _seed_settings()
    _seed_timeline()


# ── Connection helper ─────────────────────────────────────────────────────────
def get_con() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


# ── Messages ──────────────────────────────────────────────────────────────────
def save_message(conversation_id: str, role: str, content: str):
    now = datetime.now(timezone.utc).isoformat()
    con = get_con()
    cur = con.cursor()
    try:
        cur.execute("""
            INSERT INTO conversations (id, created_at, updated_at, title)
            VALUES (?, ?, ?, NULL)
            ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at
        """, (conversation_id, now, now))

        cur.execute(
            "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), conversation_id, role, content, now)
        )

        cur.execute("""
            UPDATE conversations SET title = (
                SELECT substr(content, 1, 60) || CASE WHEN length(content) > 60 THEN '...' ELSE '' END
                FROM messages WHERE conversation_id = ? AND role = 'user'
                ORDER BY created_at LIMIT 1
            ) WHERE id = ?
        """, (conversation_id, conversation_id))

        con.commit()
    except Exception as e:
        print(f"save_message error: {e}")
        con.rollback()
    finally:
        con.close()


def get_conversation_history(conversation_id: str, limit: int = 20) -> list[dict]:
    """Return the last N messages for a conversation, oldest first."""
    con = get_con()
    rows = con.execute(
        "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?",
        (conversation_id, limit)
    ).fetchall()
    con.close()
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


# ── Conversations ─────────────────────────────────────────────────────────────
def list_conversations() -> list[dict]:
    con = get_con()
    rows = con.execute(
        "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC"
    ).fetchall()
    con.close()
    return [dict(r) for r in rows]


def get_conversation(conversation_id: str) -> list[dict]:
    con = get_con()
    rows = con.execute(
        "SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at",
        (conversation_id,)
    ).fetchall()
    con.close()
    return [dict(r) for r in rows]


def delete_conversation_messages(conversation_id: str):
    """Delete all messages and the conversation record from SQLite."""
    con = get_con()
    con.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
    con.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
    con.commit()
    con.close()


# ── Documents ─────────────────────────────────────────────────────────────────
def save_document_record(doc_id: str, filename: str, file_type: str, chunk_count: int):
    now = datetime.now(timezone.utc).isoformat()
    con = get_con()
    con.execute(
        "INSERT INTO documents (id, filename, file_type, chunk_count, created_at) VALUES (?, ?, ?, ?, ?)",
        (doc_id, filename, file_type, chunk_count, now)
    )
    con.commit()
    con.close()


def list_documents() -> list[dict]:
    con = get_con()
    rows = con.execute(
        "SELECT id, filename, file_type, chunk_count, created_at FROM documents ORDER BY created_at DESC"
    ).fetchall()
    con.close()
    return [dict(r) for r in rows]


def delete_document_record(doc_id: str):
    con = get_con()
    con.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    con.commit()
    con.close()


# ── Traces ────────────────────────────────────────────────────────────────────
TRACE_RETENTION = 500  # newest N traces kept; older ones pruned on every save


def save_trace(trace: dict):
    """Insert one finished chat trace and prune anything beyond the retention cap."""
    con = get_con()
    try:
        con.execute("""
            INSERT INTO traces (id, conversation_id, created_at, user_message, path,
                                provider, model, web_search_used, status, duration_ms, steps_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            trace["id"], trace["conversation_id"], trace["created_at"],
            trace["user_message"], trace["path"], trace["provider"], trace["model"],
            trace["web_search_used"], trace["status"], trace["duration_ms"],
            trace["steps_json"],
        ))
        con.execute("""
            DELETE FROM traces WHERE id NOT IN (
                SELECT id FROM traces ORDER BY created_at DESC LIMIT ?
            )
        """, (TRACE_RETENTION,))
        con.commit()
    except Exception as e:
        print(f"save_trace error: {e}")
        con.rollback()
    finally:
        con.close()


def list_traces(limit: int = 50) -> list[dict]:
    """Newest-first trace summaries — steps_json deliberately excluded for speed."""
    con = get_con()
    rows = con.execute("""
        SELECT id, conversation_id, created_at, user_message, path, provider,
               model, web_search_used, status, duration_ms
        FROM traces ORDER BY created_at DESC LIMIT ?
    """, (limit,)).fetchall()
    con.close()
    return [dict(r) for r in rows]


def get_trace(trace_id: str) -> dict | None:
    con = get_con()
    row = con.execute(
        "SELECT * FROM traces WHERE id = ?", (trace_id,)
    ).fetchone()
    con.close()
    return dict(row) if row else None


# ── Settings ──────────────────────────────────────────────────────────────────
# Runtime configuration the settings page edits: which model answers by default,
# and the persona Lucchese is given. The persona's *default* is versioned in
# docs/character.md; this table holds the live value once it has been edited.

CHARACTER_DOC = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "character.md")

_PERSONA_FALLBACK = (
    "You are Lucchese, the personal AI of Alex Hammond.\n\n"
    "Speak to him like a straight-talking, knowledgeable friend — not an "
    "assistant trying to please him. Be direct. Never open with praise.\n"
)


def _persona_default() -> str:
    """The prompt block from docs/character.md, or a terse fallback if the doc
    isn't there (the backend must boot regardless of what's in docs/)."""
    try:
        with open(CHARACTER_DOC, encoding="utf-8") as f:
            doc = f.read()
        after = doc.split("## THE PROMPT", 1)[1]
        return after.split("```")[1].strip()
    except Exception:
        return _PERSONA_FALLBACK.strip()


def _seed_settings():
    """Insert defaults for any setting that has never been written. Existing
    values are left alone, so this is safe on every startup."""
    from routes.config import MAX_TOKENS
    defaults = {
        "default_model": "",                 # resolved from the registry when blank
        "persona":       _persona_default(),
        "max_tokens":    str(MAX_TOKENS),
    }
    now = datetime.now(timezone.utc).isoformat()
    con = get_con()
    try:
        for key, value in defaults.items():
            con.execute(
                "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
                (key, value, now),
            )
        con.commit()
    except Exception as e:
        print(f"_seed_settings error: {e}")
        con.rollback()
    finally:
        con.close()


def get_settings() -> dict:
    con = get_con()
    try:
        rows = con.execute("SELECT key, value FROM settings").fetchall()
    finally:
        con.close()
    out = {r["key"]: r["value"] for r in rows}
    try:
        out["max_tokens"] = int(out.get("max_tokens", 4096))
    except (TypeError, ValueError):
        out["max_tokens"] = 4096
    return out


def update_settings(values: dict) -> dict:
    """Write the given keys and return the full settings afterwards.
    Unknown keys are ignored — the settings page can't invent config."""
    allowed = {"default_model", "persona", "max_tokens"}
    now     = datetime.now(timezone.utc).isoformat()
    con     = get_con()
    try:
        for key, value in values.items():
            if key in allowed and value is not None:
                con.execute("""
                    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                                   updated_at = excluded.updated_at
                """, (key, str(value), now))
        con.commit()
    except Exception as e:
        print(f"update_settings error: {e}")
        con.rollback()
    finally:
        con.close()
    return get_settings()


# ── Timeline ──────────────────────────────────────────────────────────────────
# The owner page's project history. Seeded once from the real arc of the
# project so it starts useful rather than blank; everything after that is
# Alex's to edit. Status: done | now | next | idea.

TIMELINE_STATUSES = ("done", "now", "next", "idea")

_TIMELINE_SEED = [
    ("2026-06-14", "done", "Before git",
     "The app existed as folders on disk — Lucchese, Lucchese - Copy, LuccheseOld and "
     "several more. First commit 'luccheseold' put it under version control.",
     "Eleven copies of the project were still on the C: drive as of late August. "
     "Only the one with a .git folder is real.", ["commit:a107d98"]),

    ("2026-07-11", "done", "The July refactor",
     "Deal analysis, roleplay, state management and summary modules removed. "
     "This is where routes/state.py died — and where several files started "
     "referring to things that no longer existed.",
     "", ["commit:2990af5"]),

    ("2026-08-07", "done", "Per-message tracing",
     "Every POST /chat now records a step-by-step trace: which path it took and "
     "why, whether web search fired, the assembled prompt, which model answered, "
     "and swallowed errors. Readable in the terminal and in the admin Debug tab.",
     "Built because the app was a black box — the whole reason this project got "
     "organised at all.", ["commit:2392201"]),

    ("2026-08-12", "done", "Repo audit + business code removed",
     "AUDIT.md classified every file used / unused / half-finished. All PTPreps "
     "code went with it: Shopify, the Google Sheets menu layer that ran on every "
     "single message, and the business persona.",
     "The Sheets layer connected at import time, so a missing credentials.json "
     "stopped the backend booting. Removing it cut a hard startup dependency.",
     ["commit:ce75d6a", "doc:AUDIT.md"]),

    ("2026-08-13", "done", "The repo learned to explain itself",
     "CLAUDE.md, STATE.md and docs/decisions.md added. Project memory moved out "
     "of chat sessions and into files any session can read.",
     "The fix for 'it takes me ages to remember where I left off'.",
     ["commit:b5fb125", "doc:CLAUDE.md", "doc:STATE.md"]),

    ("2026-08-20", "done", "Chat UI rebuilt (direction 2b)",
     "App.jsx rewritten from the Claude Design artboards: replies read as "
     "articles in an 860px column, fenced code gets a framed panel, one voice "
     "strip with three states, ESC stops a reply.",
     "Designed in Claude Design, implemented in Claude Code. Design tools never "
     "write to the repo — that split is the workflow.",
     ["commit:3bdf243", "doc:docs/decisions.md"]),

    ("2026-08-29", "done", "Vision and character written down",
     "docs/vision.md set the MVP as one falsifiable sentence and named what "
     "Lucchese is NOT. docs/character.md made the persona a versioned artifact "
     "instead of a string in chat.py.",
     "The MVP sentence: 'I can ask Lucchese something I told it three weeks ago, "
     "and it answers correctly, in character, without me re-explaining.' "
     "The app still fails this test.",
     ["commit:bdf1dd1", "doc:docs/vision.md", "doc:docs/character.md"]),

    ("2026-08-29", "done", "Model switching + settings page",
     "Models are discovered live — Anthropic via /v1/models, Ollama via "
     "/api/tags — so a locally trained model appears in the picker with no code "
     "change. A settings page edits the default model, the persona and max "
     "tokens at runtime.",
     "Merged as PR #1.",
     ["commit:2522c3c", "doc:docs/specmodelswitching.md"]),

    (None, "now", "Run it all against the real backend",
     "The chat redesign and model switching were both verified against stand-in "
     "servers and in a browser — never against the real Ollama install or a real "
     "API key.",
     "Watch: do your actual Ollama models appear in the picker? Does switching "
     "to Claude still answer? Does voice still work?", []),

    (None, "next", "Wire memory reading into chat",
     "search_memory() in routes/memory.py is fully built — query expansion, "
     "cross-encoder reranking, recency bonus — and has zero callers. Lucchese "
     "files memories it can never recall.",
     "Flagged in every document since the audit and still open. This is the one "
     "that makes the MVP sentence true. The import was removed in da54368, so it "
     "needs adding back, not just calling.",
     ["doc:docs/vision.md", "commit:da54368"]),

    (None, "next", "Fix the exposed admin key",
     "VITE_ADMIN_KEY is compiled into the public JS bundle, so anyone loading "
     "the site can read it and call any /admin/* endpoint — including "
     "delete-memory and the writable settings page.",
     "Now blocking: with other users coming, 'admin' and 'owner' need to be "
     "genuinely different privileges. The owner page dodges this by being "
     "local-only, but the admin surface still doesn't.", []),

    (None, "next", "Delete the remaining dead code",
     "routes/scrape.py (mounted nowhere), the roleplay_sessions table, "
     "chroma_client.py and check_chroma.py, frontend App.css and unused assets.",
     "All listed in AUDIT.md with evidence.", ["doc:AUDIT.md"]),

    (None, "idea", "Memory curation",
     "Imports land as candidates and only become canon after review. Needs "
     "status / provenance / temporality / supersedes on each memory, and a "
     "review UI.",
     "Design is sketched in docs/vision.md but the shape isn't settled yet. "
     "The point: 200 curated memories beat 20,000 raw ones.",
     ["doc:docs/vision.md"]),

    (None, "idea", "Backend layering",
     "Split endpoints / services / clients so working on one thing doesn't mean "
     "reading chat.py end to end. The real target is import-time side effects, "
     "not just file structure.",
     "config.py loads Whisper at import; memory.py loads two ML models. That's "
     "what makes the app fragile, and moving files won't fix it.", []),

    (None, "idea", "Train the local model",
     "A model trained from scratch, served through Ollama.",
     "Nothing in the app blocks this — the registry discovers whatever Ollama "
     "has, so it appears in the picker the moment it's pulled.", []),
]


def _seed_timeline():
    """Populate the timeline once, from the project's real history. Never
    overwrites: if the table has anything in it, this does nothing."""
    con = get_con()
    try:
        existing = con.execute("SELECT COUNT(*) AS n FROM timeline").fetchone()["n"]
        if existing:
            return
        now = datetime.now(timezone.utc).isoformat()
        for i, (occurred, status, title, body, notes, refs) in enumerate(_TIMELINE_SEED):
            con.execute("""
                INSERT INTO timeline (id, title, body, notes, phase, status,
                                      occurred_at, position, refs_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?)
            """, (uuid.uuid4().hex[:12], title, body, notes, status,
                  occurred, i * 10, json.dumps(refs), now, now))
        con.commit()
    except Exception as e:
        print(f"_seed_timeline error: {e}")
        con.rollback()
    finally:
        con.close()


def _row_to_entry(r) -> dict:
    d = dict(r)
    try:
        d["refs"] = json.loads(d.pop("refs_json") or "[]")
    except Exception:
        d["refs"] = []
    return d


def list_timeline() -> list[dict]:
    con = get_con()
    try:
        rows = con.execute(
            "SELECT * FROM timeline ORDER BY position ASC, created_at ASC"
        ).fetchall()
    finally:
        con.close()
    return [_row_to_entry(r) for r in rows]


def get_timeline_entry(entry_id: str) -> dict | None:
    con = get_con()
    try:
        row = con.execute("SELECT * FROM timeline WHERE id = ?", (entry_id,)).fetchone()
    finally:
        con.close()
    return _row_to_entry(row) if row else None


def create_timeline_entry(data: dict) -> dict:
    now      = datetime.now(timezone.utc).isoformat()
    entry_id = uuid.uuid4().hex[:12]
    con      = get_con()
    try:
        nxt = con.execute("SELECT COALESCE(MAX(position), 0) + 10 AS p FROM timeline").fetchone()["p"]
        con.execute("""
            INSERT INTO timeline (id, title, body, notes, phase, status,
                                  occurred_at, position, refs_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (entry_id, data.get("title", "Untitled"), data.get("body", ""),
              data.get("notes", ""), data.get("phase", ""),
              data.get("status", "idea"), data.get("occurred_at"),
              data.get("position", nxt), json.dumps(data.get("refs", [])), now, now))
        con.commit()
    finally:
        con.close()
    return get_timeline_entry(entry_id)


def update_timeline_entry(entry_id: str, data: dict) -> dict | None:
    allowed = {"title", "body", "notes", "phase", "status", "occurred_at", "position"}
    sets, vals = [], []
    for k, v in data.items():
        if k in allowed and v is not None:
            sets.append(f"{k} = ?")
            vals.append(v)
    if "refs" in data and data["refs"] is not None:
        sets.append("refs_json = ?")
        vals.append(json.dumps(data["refs"]))
    if not sets:
        return get_timeline_entry(entry_id)

    sets.append("updated_at = ?")
    vals.append(datetime.now(timezone.utc).isoformat())
    vals.append(entry_id)

    con = get_con()
    try:
        con.execute(f"UPDATE timeline SET {', '.join(sets)} WHERE id = ?", vals)
        con.commit()
    finally:
        con.close()
    return get_timeline_entry(entry_id)


def delete_timeline_entry(entry_id: str) -> bool:
    con = get_con()
    try:
        cur = con.execute("DELETE FROM timeline WHERE id = ?", (entry_id,))
        con.commit()
        return cur.rowcount > 0
    finally:
        con.close()


def reorder_timeline(ids: list[str]) -> list[dict]:
    """Write the given order as positions, spaced so single moves stay cheap."""
    con = get_con()
    try:
        for i, entry_id in enumerate(ids):
            con.execute("UPDATE timeline SET position = ? WHERE id = ?", (i * 10, entry_id))
        con.commit()
    finally:
        con.close()
    return list_timeline()


# ── Session DB helpers ────────────────────────────────────────────────────────
def get_roleplay_session(conversation_id: str) -> dict | None:
    con = get_con()
    row = con.execute(
        "SELECT exchanges FROM roleplay_sessions WHERE conversation_id = ?",
        (conversation_id,)
    ).fetchone()
    con.close()
    return {"exchanges": row["exchanges"]} if row else None


def upsert_roleplay_session(conversation_id: str, exchanges: int):
    now = datetime.now(timezone.utc).isoformat()
    con = get_con()
    con.execute("""
        INSERT INTO roleplay_sessions (conversation_id, exchanges, created_at)
        VALUES (?, ?, ?)
        ON CONFLICT(conversation_id) DO UPDATE SET exchanges = excluded.exchanges
    """, (conversation_id, exchanges, now))
    con.commit()
    con.close()


def delete_roleplay_session(conversation_id: str) -> dict:
    session = get_roleplay_session(conversation_id)
    con = get_con()
    con.execute(
        "DELETE FROM roleplay_sessions WHERE conversation_id = ?",
        (conversation_id,)
    )
    con.commit()
    con.close()
    return session or {}