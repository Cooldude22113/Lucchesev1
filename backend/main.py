import logging
import os
from logging.handlers import RotatingFileHandler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.database import init_db
from routes.chat import router as chat_router
from routes.admin import router as admin_router
from routes.conversations import router as conv_router
from routes.files import router as files_router
from routes.voice import router as voice_router
from routes.traces import router as traces_router
from routes.models import router as models_router
from routes.settings import router as settings_router

# ── Chat trace logger ────────────────────────────────────────────────────────
# "lucchese.context" carries the per-message traces written by routes/tracer.py:
# readable step-by-step lines for every POST /chat, printed to the console and
# mirrored to a rotating file (5 MB × 5 backups). Scoped to this logger name
# only — the root logger format is untouched. The structured version of each
# trace lives in the SQLite traces table (see routes/database.py).

_CONTEXT_LOG_PATH = "lucchese.context.log"
_CONTEXT_LOG_MAX_BYTES = 5_242_880   # 5 MB
_CONTEXT_LOG_BACKUP_COUNT = 5


class _PassthroughFormatter(logging.Formatter):
    """Emit log messages exactly as given — no timestamp/level prefix."""
    def format(self, record: logging.LogRecord) -> str:
        return record.getMessage()


def _configure_context_logger() -> None:
    formatter = _PassthroughFormatter()

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)

    file_handler = RotatingFileHandler(
        filename=_CONTEXT_LOG_PATH,
        maxBytes=_CONTEXT_LOG_MAX_BYTES,
        backupCount=_CONTEXT_LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)

    context_logger = logging.getLogger("lucchese.context")
    context_logger.setLevel(logging.INFO)
    context_logger.addHandler(stream_handler)
    context_logger.addHandler(file_handler)
    context_logger.propagate = False   # prevent double-emission via root logger


_configure_context_logger()

logging.getLogger("lucchese.context").info(
    f"[trace] chat tracing active — console + {os.path.abspath(_CONTEXT_LOG_PATH)}"
)

# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://192.168.1.112:5173",
        "https://lucchese.app",
        "https://www.lucchese.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

app.include_router(chat_router)
app.include_router(admin_router)
app.include_router(conv_router)
app.include_router(files_router)
app.include_router(voice_router)
app.include_router(traces_router)
app.include_router(models_router)
app.include_router(settings_router)