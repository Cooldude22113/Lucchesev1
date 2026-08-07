"""
routes/traces.py
────────────────
Chat-trace endpoints for the admin Debug tab — protected by X-Admin-Key.

  GET /admin/traces            — newest-first trace summaries
  GET /admin/traces/{trace_id} — one full trace, steps parsed
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from routes.config import verify_admin_key
from routes.database import list_traces, get_trace


router = APIRouter()


@router.get("/admin/traces")
def admin_traces(limit: int = 50, admin_key: str = Depends(verify_admin_key)):
    return list_traces(limit)


@router.get("/admin/traces/{trace_id}")
def admin_trace_detail(trace_id: str, admin_key: str = Depends(verify_admin_key)):
    row = get_trace(trace_id)
    if not row:
        raise HTTPException(status_code=404, detail="Trace not found")
    try:
        row["steps"] = json.loads(row.pop("steps_json") or "[]")
    except Exception:
        row["steps"] = []
    return row
