"""
database.py
All SQLite database operations for Lucchese.
Handles: schema init, conversations, messages, documents, traces, settings.
"""

import os
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
    con.commit()
    con.close()
    _seed_settings()


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
