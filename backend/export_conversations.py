"""
export_conversations.py
Standalone CLI exporter for conversations.db.

Dumps the `conversations` and `messages` tables to a single structured JSON file,
with messages nested under their parent conversation. Stdlib only, read-only.

Usage (run from backend/):
    python export_conversations.py [--out PATH] [--db PATH] [--pretty]
"""

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone

# Default DB path mirrors database.py's DB_PATH (resolved relative to CWD).
DEFAULT_DB_PATH = "./conversations.db"


def open_db(db_path: str) -> sqlite3.Connection:
    """Open a read-only-style connection with dict-like rows."""
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    return con


def build_export(con: sqlite3.Connection, db_path: str) -> dict:
    conversations = [
        dict(r)
        for r in con.execute(
            "SELECT id, title, created_at, updated_at "
            "FROM conversations ORDER BY updated_at DESC"
        ).fetchall()
    ]

    # Group messages by conversation_id, preserving chronological order.
    messages_by_conv: dict[str, list[dict]] = {}
    message_count = 0
    for r in con.execute(
        "SELECT id, conversation_id, role, content, created_at "
        "FROM messages ORDER BY created_at"
    ).fetchall():
        message_count += 1
        messages_by_conv.setdefault(r["conversation_id"], []).append(
            {
                "id": r["id"],
                "role": r["role"],
                "content": r["content"],
                "created_at": r["created_at"],
            }
        )

    for conv in conversations:
        conv["messages"] = messages_by_conv.pop(conv["id"], [])

    # Any messages left over reference conversations with no header row.
    if messages_by_conv:
        orphan_msgs = sum(len(v) for v in messages_by_conv.values())
        print(
            f"warning: {orphan_msgs} message(s) across {len(messages_by_conv)} "
            "orphan conversation id(s) had no conversations row; dropped.",
            file=sys.stderr,
        )

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "source_db": os.path.abspath(db_path),
        "counts": {
            "conversations": len(conversations),
            "messages": message_count,
        },
        "conversations": conversations,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export conversations.db (conversations + messages) to JSON."
    )
    parser.add_argument(
        "--out",
        default="./conversations_export.json",
        help="Output JSON path (default: ./conversations_export.json)",
    )
    parser.add_argument(
        "--db",
        default=DEFAULT_DB_PATH,
        help=f"Path to conversations.db (default: {DEFAULT_DB_PATH})",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print JSON with indentation",
    )
    args = parser.parse_args()

    if not os.path.exists(args.db):
        print(f"error: database not found: {os.path.abspath(args.db)}", file=sys.stderr)
        return 1

    con = open_db(args.db)
    try:
        export = build_export(con, args.db)
    finally:
        con.close()

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(
            export,
            f,
            ensure_ascii=False,
            indent=2 if args.pretty else None,
        )

    counts = export["counts"]
    print(
        f"exported {counts['conversations']} conversation(s), "
        f"{counts['messages']} message(s) -> {os.path.abspath(args.out)}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
