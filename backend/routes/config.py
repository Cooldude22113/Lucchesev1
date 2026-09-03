"""
config.py
Environment variables, API clients, and shared FastAPI dependencies for Lucchese.
Everything that needs to be initialised once at startup and imported everywhere.
"""

import os
import ipaddress
import whisper
from dotenv import load_dotenv
from fastapi import Header, HTTPException, Request
from elevenlabs.client import ElevenLabs

load_dotenv()

# ── LLM config ────────────────────────────────────────────────────────────────
OLLAMA_BASE       = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_URL        = OLLAMA_BASE + "/api/chat"
OLLAMA_TAGS_URL   = OLLAMA_BASE + "/api/tags"   # installed models, for the registry
MODEL_FAST        = os.getenv("MODEL_FAST", "gemma2:27b")
MODEL_DEEP        = os.getenv("MODEL_DEEP", "qwen2.5:32b")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_API_URL = "https://api.anthropic.com/v1"
ANTHROPIC_VERSION = "2023-06-01"
CHAT_PROVIDER     = os.getenv("CHAT_PROVIDER", "ollama")   # default when no model is chosen
MAX_TOKENS        = int(os.getenv("MAX_TOKENS", "4096"))

# ── ElevenLabs ────────────────────────────────────────────────────────────────
ELEVENLABS_API_KEY  = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID")
el_client           = ElevenLabs(api_key=ELEVENLABS_API_KEY) if ELEVENLABS_API_KEY else None

# ── Whisper ───────────────────────────────────────────────────────────────────
# TODO: upgrade to large-v3 when blocking startup is fixed
whisper_model = whisper.load_model("tiny")

# ── Admin auth ────────────────────────────────────────────────────────────────
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")
print(f"[config] ADMIN_API_KEY loaded: {bool(ADMIN_API_KEY)}")


async def verify_admin_key(x_admin_key: str = Header(None)):
    if not ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Admin API key not configured")
    if not x_admin_key or x_admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid admin key")
    return x_admin_key


# ── Owner-only auth ───────────────────────────────────────────────────────────
# The admin surface is for users; the owner surface is Alex's alone. It can't be
# protected by another key, because anything the frontend holds ships inside the
# public JS bundle (see VITE_ADMIN_KEY). So owner endpoints are gated on *where
# the request came from* instead: the machine the backend runs on.
#
# The subtlety that makes this work: cloudflared runs on that same machine and
# proxies to localhost, so a request from the open internet ALSO arrives with
# client host 127.0.0.1. Checking the address alone would admit everyone. A
# tunnelled request is distinguished by the forwarding headers Cloudflare adds,
# so their presence is treated as proof the request is *not* local.

_LOOPBACK = {"127.0.0.1", "::1", "localhost", "::ffff:127.0.0.1"}

# Any of these means the request passed through a proxy or tunnel to get here.
_PROXY_HEADERS = (
    "cf-connecting-ip", "cf-ray", "cf-ipcountry",
    "x-forwarded-for", "x-forwarded-host", "x-real-ip",
)

# Set OWNER_ALLOW_LAN=true to also allow other devices on your home network
# (e.g. reaching the owner page from a phone on the same wifi).
OWNER_ALLOW_LAN = os.getenv("OWNER_ALLOW_LAN", "false").lower() == "true"


def _is_private_lan(host: str) -> bool:
    try:
        return ipaddress.ip_address(host.replace("::ffff:", "")).is_private
    except ValueError:
        return False


async def verify_owner_local(request: Request):
    """Allow only requests originating on this machine (or the LAN, if enabled)."""
    present = [h for h in _PROXY_HEADERS if h in request.headers]
    if present:
        raise HTTPException(
            status_code=403,
            detail=("Owner endpoints are local-only and this request came through a "
                    f"proxy or tunnel (saw {', '.join(present)}). Open the app directly "
                    "on the machine running the backend."),
        )

    host = request.client.host if request.client else ""
    allowed = host in _LOOPBACK or (OWNER_ALLOW_LAN and _is_private_lan(host))
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail=(f"Owner endpoints are local-only; this request came from {host or 'an unknown address'}. "
                    "Set OWNER_ALLOW_LAN=true in backend/.env to allow your home network."),
        )
    return host