"""
routes/settings.py
──────────────────
Runtime configuration for the settings page — protected by X-Admin-Key like
every other admin surface.

  GET /settings → {"default_model": ..., "persona": ..., "max_tokens": ...}
  PUT /settings   any subset of those; returns the settings after the write

The persona edited here overrides the default that ships in docs/character.md.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from routes.config import verify_admin_key
from routes.database import get_settings, update_settings
from routes.models import resolve

router = APIRouter()


class SettingsUpdate(BaseModel):
    default_model: Optional[str] = None
    persona:       Optional[str] = None
    max_tokens:    Optional[int] = None


@router.get("/settings")
def read_settings(admin_key: str = Depends(verify_admin_key)):
    return get_settings()


@router.put("/settings")
async def write_settings(req: SettingsUpdate, admin_key: str = Depends(verify_admin_key)):
    if req.default_model:
        if not await resolve(req.default_model):
            raise HTTPException(
                status_code=400,
                detail=f"Unknown model '{req.default_model}' — see GET /models.",
            )
    if req.max_tokens is not None and not (1 <= req.max_tokens <= 128_000):
        raise HTTPException(status_code=400, detail="max_tokens must be 1–128000.")

    return update_settings(req.model_dump(exclude_none=True))
