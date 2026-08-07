"""
routes/tracer.py
────────────────
Per-message trace capture for POST /chat.

A Trace is a step-by-step record of everything one chat message went through:
which path it took and why, what was searched, what prompt was built, which
model was called, and whether the exchange was saved to memory. Each step
carries a plain-English summary plus a raw technical detail dict.

chat.py creates and finishes the trace; memory.py adds steps to whichever
trace is active via current(), so its function signatures stay unchanged.

Every public method is guarded — a bug in tracing logs a warning and the chat
proceeds untouched. Tracing must never break or slow a reply.
"""

import json
import time
import uuid
import logging
import contextvars
from contextlib import contextmanager
from datetime import datetime, timezone

log = logging.getLogger("lucchese.context")

# The active trace for the request being processed. chat.py sets it at the top
# of the endpoint and re-activates it inside the streaming generator (async
# generators don't reliably inherit context set after task creation).
_current: contextvars.ContextVar = contextvars.ContextVar("lucchese_trace", default=None)


class _StepRecorder:
    """Mutable holder the instrumented block fills in while a step runs."""
    def __init__(self, name: str):
        self.name          = name
        self.summary       = ""      # plain-English sentence shown everywhere
        self.error_summary = ""      # used instead of summary if the block raises
        self.status        = "ok"    # "ok" | "error" | "skipped"
        self.detail        = {}      # raw technical payload
        self.error         = None


class Trace:
    def __init__(self, user_message: str, conversation_id: str):
        self.id              = uuid.uuid4().hex[:8]
        self.conversation_id = conversation_id
        self.created_at      = datetime.now(timezone.utc).isoformat()
        self.user_message    = (user_message or "")[:300]
        self.path            = "chat"     # "chat" | "remember" | "forget"
        self.provider        = "none"     # "claude" | "ollama" | "none"
        self.model           = ""
        self.web_search_used = False
        self.status          = "ok"       # "ok" | "partial" | "error"
        self.duration_ms     = 0
        self.steps           = []
        self._t0             = time.perf_counter()
        self._finished       = False

    def _elapsed_ms(self) -> int:
        return int((time.perf_counter() - self._t0) * 1000)

    # ── Recording ─────────────────────────────────────────────────────────────
    def add_step(self, name: str, summary: str, status: str = "ok",
                 detail: dict = None, error: str = None, duration_ms: float = 0):
        try:
            self.steps.append({
                "name":        name,
                "summary":     summary,
                "status":      status,
                "started_ms":  max(0, self._elapsed_ms() - int(duration_ms)),
                "duration_ms": int(duration_ms),
                "detail":      detail or {},
                "error":       error,
            })
        except Exception as e:
            log.warning(f"[trace {self.id}] add_step({name}) failed: {e}")

    @contextmanager
    def step(self, name: str):
        """
        Time a block and record it as one step. The block fills the yielded
        recorder (summary, detail). If the block raises, the step is recorded
        as an error and the exception re-raised — existing error handling in
        the instrumented code is unchanged.
        """
        rec   = _StepRecorder(name)
        start = time.perf_counter()
        try:
            yield rec
        except Exception as e:
            rec.status = "error"
            rec.error  = f"{type(e).__name__}: {e}"
            if rec.error_summary:
                rec.summary = rec.error_summary
            raise
        finally:
            duration = (time.perf_counter() - start) * 1000
            self.add_step(rec.name, rec.summary or rec.name, rec.status,
                          rec.detail, rec.error, duration)

    # ── Finishing ─────────────────────────────────────────────────────────────
    def finish(self, reply_ok: bool = True):
        """Compute final status, print the readable trace, persist to SQLite."""
        try:
            if self._finished:
                return
            self._finished   = True
            self.duration_ms = self._elapsed_ms()
            step_errors      = any(s["status"] == "error" for s in self.steps)
            self.status      = "error" if not reply_ok else ("partial" if step_errors else "ok")
        except Exception as e:
            log.warning(f"[trace] finish failed: {e}")
            return
        try:
            self._log_readable()
        except Exception as e:
            log.warning(f"[trace {self.id}] console output failed: {e}")
        try:
            self._persist()
        except Exception as e:
            log.warning(f"[trace {self.id}] persist failed: {e}")

    def _log_readable(self):
        marks   = {"ok": "✓", "error": "✗", "skipped": "·"}
        preview = self.user_message[:60] + ("…" if len(self.user_message) > 60 else "")
        lines   = [f"── TRACE {self.id} · \"{preview}\" " + "─" * 20]
        for i, s in enumerate(self.steps, 1):
            mark = marks.get(s["status"], "?")
            lines.append(f" {i}. {mark} {s['summary']}  ({s['duration_ms']} ms)")
            if s["error"]:
                lines.append(f"      ↳ error: {s['error']}")
        model = f" · {self.model} ({self.provider})" if self.model else ""
        lines.append(
            f"── DONE in {self.duration_ms / 1000:.1f} s"
            f" · path: {self.path}{model} · status: {self.status} "
            + "─" * 20
        )
        log.info("\n".join(lines))

    def _persist(self):
        from routes.database import save_trace
        save_trace({
            "id":              self.id,
            "conversation_id": self.conversation_id,
            "created_at":      self.created_at,
            "user_message":    self.user_message,
            "path":            self.path,
            "provider":        self.provider,
            "model":           self.model,
            "web_search_used": int(self.web_search_used),
            "status":          self.status,
            "duration_ms":     self.duration_ms,
            "steps_json":      json.dumps(self.steps, ensure_ascii=False, default=str),
        })


# ── No-op stand-in ────────────────────────────────────────────────────────────
class _NoopTrace:
    """Returned by current() when no trace is active — every call does nothing."""
    def add_step(self, *args, **kwargs):
        pass

    @contextmanager
    def step(self, name: str):
        yield _StepRecorder(name)

    def finish(self, *args, **kwargs):
        pass


_NOOP = _NoopTrace()


# ── Module API ────────────────────────────────────────────────────────────────
def activate(trace: Trace):
    """Bind a trace to the current context so current() finds it."""
    try:
        _current.set(trace)
    except Exception as e:
        log.warning(f"[trace] activate failed: {e}")


def current():
    """The active trace, or a no-op stand-in when nothing is being traced."""
    try:
        t = _current.get()
        return t if (t is not None and not t._finished) else _NOOP
    except Exception:
        return _NOOP
