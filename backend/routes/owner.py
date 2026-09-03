"""
routes/owner.py
───────────────
The owner surface — Alex's alone, separate from /admin/* which is for users.

Gated by verify_owner_local (routes/config.py): these endpoints only answer
requests that originate on the machine running the backend. They are
unreachable through the Cloudflare tunnel, so no secret ships to the browser
and there is nothing for a visitor to steal.

  GET    /owner/whoami            — is this caller the owner? (used by the UI)
  GET    /owner/timeline          — every entry, in order
  POST   /owner/timeline          — create
  PUT    /owner/timeline/{id}     — update (any subset of fields)
  DELETE /owner/timeline/{id}     — remove
  POST   /owner/timeline/reorder  — write a new order
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from routes.config import verify_owner_local, OWNER_ALLOW_LAN
from routes.database import (
    TIMELINE_STATUSES, list_timeline, create_timeline_entry,
    update_timeline_entry, delete_timeline_entry, reorder_timeline,
)

router = APIRouter()


class TimelineEntry(BaseModel):
    title:       Optional[str]       = None
    body:        Optional[str]       = None
    notes:       Optional[str]       = None
    phase:       Optional[str]       = None
    status:      Optional[str]       = None
    occurred_at: Optional[str]       = None
    position:    Optional[int]       = None
    refs:        Optional[List[str]] = None


class ReorderRequest(BaseModel):
    ids: List[str]


def _check_status(status: Optional[str]):
    if status is not None and status not in TIMELINE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of {', '.join(TIMELINE_STATUSES)}",
        )


@router.get("/owner/whoami")
def whoami(host: str = Depends(verify_owner_local)):
    """The UI calls this to decide whether to render the owner page at all."""
    return {"owner": True, "host": host, "lan_allowed": OWNER_ALLOW_LAN}


@router.get("/owner/timeline")
def get_timeline(host: str = Depends(verify_owner_local)):
    return list_timeline()


@router.post("/owner/timeline")
def post_timeline(req: TimelineEntry, host: str = Depends(verify_owner_local)):
    _check_status(req.status)
    data = req.model_dump(exclude_none=True)
    if not data.get("title"):
        raise HTTPException(status_code=400, detail="An entry needs a title.")
    return create_timeline_entry(data)


@router.put("/owner/timeline/{entry_id}")
def put_timeline(entry_id: str, req: TimelineEntry, host: str = Depends(verify_owner_local)):
    _check_status(req.status)
    updated = update_timeline_entry(entry_id, req.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(status_code=404, detail="No such timeline entry.")
    return updated


@router.delete("/owner/timeline/{entry_id}")
def remove_timeline(entry_id: str, host: str = Depends(verify_owner_local)):
    if not delete_timeline_entry(entry_id):
        raise HTTPException(status_code=404, detail="No such timeline entry.")
    return {"deleted": entry_id}


@router.post("/owner/timeline/reorder")
def post_reorder(req: ReorderRequest, host: str = Depends(verify_owner_local)):
    return reorder_timeline(req.ids)
