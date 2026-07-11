"""
Extract only user messages from a ChatGPT export.

Input:
  - conversations.json
  - or the exported folder containing conversations.json

Outputs:
  - user_messages.jsonl
  - user_messages.txt
"""

import argparse
import json
from pathlib import Path
from datetime import datetime, timezone


def unix_to_iso(timestamp):
    if not timestamp:
        return None

    try:
        return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()
    except Exception:
        return None


def extract_text_from_part(part):
    """
    ChatGPT exports can store content parts as strings or nested objects.
    This tries to recover readable text without crashing like a dramatic toaster.
    """

    if isinstance(part, str):
        return part

    if isinstance(part, dict):
        # Common text-like fields
        for key in ("text", "content", "value"):
            value = part.get(key)
            if isinstance(value, str):
                return value

        # Sometimes nested lists/dicts appear
        collected = []
        for value in part.values():
            if isinstance(value, str):
                collected.append(value)
            elif isinstance(value, list):
                collected.extend(extract_text_from_part(item) for item in value)
            elif isinstance(value, dict):
                collected.append(extract_text_from_part(value))

        return "\n".join(t for t in collected if t)

    if isinstance(part, list):
        return "\n".join(
            extract_text_from_part(item)
            for item in part
            if extract_text_from_part(item)
        )

    return ""


def extract_message_text(message):
    content = message.get("content") or {}
    parts = content.get("parts", [])

    if isinstance(parts, list):
        text_parts = []
        for part in parts:
            extracted = extract_text_from_part(part)
            if extracted:
                text_parts.append(extracted)

        return "\n".join(text_parts).strip()

    if isinstance(parts, str):
        return parts.strip()

    return ""


def load_conversations(input_path):
    input_path = Path(input_path)

    if input_path.is_dir():
        input_path = input_path / "conversations.json"

    if not input_path.exists():
        raise FileNotFoundError(f"Could not find: {input_path}")

    with input_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("Expected conversations.json to contain a list of conversations.")

    return data


def extract_user_messages(conversations, include_empty=False):
    extracted = []

    for convo in conversations:
        convo_id = convo.get("id")
        title = convo.get("title") or "Untitled conversation"
        mapping = convo.get("mapping") or {}

        messages = []

        for node_id, node in mapping.items():
            message = node.get("message")

            if not message:
                continue

            author = message.get("author") or {}
            role = author.get("role")

            if role != "user":
                continue

            text = extract_message_text(message)

            if not text and not include_empty:
                continue

            messages.append({
                "conversation_id": convo_id,
                "conversation_title": title,
                "message_id": message.get("id") or node_id,
                "create_time": message.get("create_time"),
                "create_time_iso": unix_to_iso(message.get("create_time")),
                "text": text,
            })

        # Sort messages inside each conversation chronologically
        messages.sort(key=lambda m: m["create_time"] or 0)
        extracted.extend(messages)

    # Sort everything globally too
    extracted.sort(key=lambda m: m["create_time"] or 0)

    return extracted


def write_jsonl(messages, output_path):
    with output_path.open("w", encoding="utf-8") as f:
        for message in messages:
            f.write(json.dumps(message, ensure_ascii=False) + "\n")


def write_txt(messages, output_path):
    current_convo = None

    with output_path.open("w", encoding="utf-8") as f:
        for message in messages:
            convo_key = message["conversation_id"]

            if convo_key != current_convo:
                current_convo = convo_key
                f.write("\n" + "=" * 80 + "\n")
                f.write(f"Conversation: {message['conversation_title']}\n")
                f.write(f"Conversation ID: {message['conversation_id']}\n")
                f.write("=" * 80 + "\n\n")

            timestamp = message.get("create_time_iso") or "Unknown time"
            f.write(f"[{timestamp}]\n")
            f.write(message["text"])
            f.write("\n\n")


def main():
    parser = argparse.ArgumentParser(
        description="Extract only user messages from ChatGPT conversations.json"
    )

    parser.add_argument(
        "input",
        help="Path to conversations.json or the exported ChatGPT folder"
    )

    parser.add_argument(
        "-o",
        "--output-dir",
        default="extracted_user_messages",
        help="Directory to save output files"
    )

    parser.add_argument(
        "--include-empty",
        action="store_true",
        help="Include empty user messages"
    )

    args = parser.parse_args()

    conversations = load_conversations(args.input)
    messages = extract_user_messages(
        conversations,
        include_empty=args.include_empty
    )

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    jsonl_path = output_dir / "user_messages.jsonl"
    txt_path = output_dir / "user_messages.txt"

    write_jsonl(messages, jsonl_path)
    write_txt(messages, txt_path)

    print(f"Extracted {len(messages)} user messages.")
    print(f"JSONL saved to: {jsonl_path}")
    print(f"TXT saved to:   {txt_path}")


if __name__ == "__main__":
    main()