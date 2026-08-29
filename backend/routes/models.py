"""
routes/models.py
────────────────
The model registry: which chat models Lucchese can use right now.

Both providers are discovered live rather than hardcoded:
  - Anthropic  → GET /v1/models
  - Ollama     → GET /api/tags   (whatever is installed locally)

That means a model pulled into Ollama — including one Alex trains himself —
appears in the picker with no code change. Discovery failures are never fatal:
a provider that can't be reached is reported as unavailable, with the reason,
and the other provider still lists.

  GET /models → {"default": "<id>", "models": [...]}

Each entry:
  id         stable slug used by the API and the UI ("gemma2-27b")
  label      human name for the picker
  provider   "anthropic" | "ollama"
  model      the provider's own name for it ("gemma2:27b")
  streams    whether replies arrive token by token
  available  usable right now
  note       why not, when unavailable
"""

import re
import time
import httpx
from fastapi import APIRouter

from routes.config import (
    ANTHROPIC_API_KEY, ANTHROPIC_API_URL, ANTHROPIC_VERSION,
    OLLAMA_TAGS_URL, MODEL_FAST, CHAT_PROVIDER,
)

router = APIRouter()

DISCOVERY_TIMEOUT = 5      # seconds; the picker should never hang on a dead provider
CACHE_TTL         = 60     # seconds; chat resolves models per message, don't re-poll each time

# Listed if the Anthropic API can't be reached but a key is configured, so the
# picker still offers something sensible. Live discovery supersedes this.
_ANTHROPIC_FALLBACK = [
    ("claude-opus-5",     "Claude Opus 5"),
    ("claude-sonnet-5",   "Claude Sonnet 5"),
    ("claude-sonnet-4-6", "Claude Sonnet 4.6"),
    ("claude-haiku-4-5",  "Claude Haiku 4.5"),
]

_cache: dict = {"at": 0.0, "models": []}


def slug(name: str) -> str:
    """'gemma2:27b' → 'gemma2-27b'. Ollama names carry colons and dots; URLs and
    JSON keys are happier without them, and the slug is what the UI sends back."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _entry(id_: str, label: str, provider: str, model: str,
           streams: bool, available: bool, note: str = "") -> dict:
    return {
        "id": id_, "label": label, "provider": provider, "model": model,
        "streams": streams, "available": available, "note": note,
    }


# ── Discovery ─────────────────────────────────────────────────────────────────
async def _discover_anthropic() -> list[dict]:
    if not ANTHROPIC_API_KEY:
        return [
            _entry(slug(m), label, "anthropic", m, False, False,
                   "ANTHROPIC_API_KEY is not set in backend/.env")
            for m, label in _ANTHROPIC_FALLBACK
        ]
    try:
        async with httpx.AsyncClient(timeout=DISCOVERY_TIMEOUT) as client:
            res = await client.get(
                f"{ANTHROPIC_API_URL}/models",
                headers={"x-api-key": ANTHROPIC_API_KEY,
                         "anthropic-version": ANTHROPIC_VERSION},
                params={"limit": 100},
            )
        if res.status_code != 200:
            raise RuntimeError(f"HTTP {res.status_code}")
        return [
            _entry(slug(m["id"]), m.get("display_name") or m["id"],
                   "anthropic", m["id"], False, True)
            for m in res.json().get("data", [])
        ]
    except Exception as e:
        note = f"Couldn't reach the Anthropic API ({type(e).__name__})"
        return [
            _entry(slug(m), label, "anthropic", m, False, False, note)
            for m, label in _ANTHROPIC_FALLBACK
        ]


async def _discover_ollama() -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=DISCOVERY_TIMEOUT) as client:
            res = await client.get(OLLAMA_TAGS_URL)
        if res.status_code != 200:
            raise RuntimeError(f"HTTP {res.status_code}")
        out = []
        for m in res.json().get("models", []):
            name = m.get("name") or m.get("model")
            if not name:
                continue
            size_gb = round(m.get("size", 0) / 1_000_000_000, 1)
            label   = f"{name} (local{f', {size_gb} GB' if size_gb else ''})"
            out.append(_entry(slug(name), label, "ollama", name, True, True))
        return out
    except Exception as e:
        # Ollama not running is the normal case when CHAT_PROVIDER=claude —
        # still surface the configured model so the picker explains itself.
        return [_entry(slug(MODEL_FAST), f"{MODEL_FAST} (local)", "ollama",
                       MODEL_FAST, True, False,
                       f"Ollama isn't reachable ({type(e).__name__}) — is it running?")]


async def list_models(force: bool = False) -> list[dict]:
    """Every known model, Anthropic first. Cached briefly so per-message
    resolution doesn't re-poll both providers."""
    now = time.time()
    if not force and _cache["models"] and (now - _cache["at"]) < CACHE_TTL:
        return _cache["models"]

    models = await _discover_anthropic() + await _discover_ollama()
    _cache.update(at=now, models=models)
    return models


async def resolve(model_id: str | None) -> dict | None:
    """The registry entry for an id, or None if it isn't a model we know."""
    if not model_id:
        return None
    return next((m for m in await list_models() if m["id"] == model_id), None)


async def fallback_model() -> dict | None:
    """Used when no model is chosen and no default is set: honour the old
    CHAT_PROVIDER env var, then settle for anything available."""
    models = await list_models()
    provider = "anthropic" if CHAT_PROVIDER == "claude" else "ollama"
    return (next((m for m in models if m["provider"] == provider and m["available"]), None)
            or next((m for m in models if m["available"]), None))


# ── GET /models ───────────────────────────────────────────────────────────────
@router.get("/models")
async def get_models(refresh: bool = False):
    from routes.database import get_settings   # local import avoids a cycle

    models  = await list_models(force=refresh)
    default = (get_settings() or {}).get("default_model", "")
    if not any(m["id"] == default for m in models):
        entry   = await fallback_model()
        default = entry["id"] if entry else ""
    return {"default": default, "models": models}
