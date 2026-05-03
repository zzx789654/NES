import json
import logging
import os
import time
from contextlib import asynccontextmanager

from alembic import command as alembic_command
from alembic.config import Config as AlembicConfig
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from limiter import limiter
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from database import Base, engine
from routers import auth, scans, nist, ipgroups, dashboard

logging.basicConfig(level=logging.INFO, format="%(message)s")
audit_logger = logging.getLogger("audit")
logger = logging.getLogger("main")


def _run_migrations() -> None:
    """Apply any pending Alembic migrations before serving traffic."""
    alembic_ini = os.path.join(os.path.dirname(__file__), "alembic.ini")
    if not os.path.exists(alembic_ini):
        # Fallback for environments without alembic config (e.g. bare dev clone)
        Base.metadata.create_all(bind=engine)
        logger.warning("alembic.ini not found — used create_all() as fallback")
        return
    cfg = AlembicConfig(alembic_ini)
    alembic_command.upgrade(cfg, "head")
    logger.info("Database migrations up to date")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _run_migrations()
    yield


app = FastAPI(
    title="SecVision ISMS API",
    version="1.0.0",
    description="Backend API for SecVision ISMS Security Portal",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ---------------------------------------------------------------------------
# Security Headers Middleware
# ---------------------------------------------------------------------------
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
        # CSP: API-only service; restrict resource loading
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        return response


# ---------------------------------------------------------------------------
# Audit Logging Middleware
# ---------------------------------------------------------------------------
class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.monotonic()
        response = await call_next(request)
        elapsed_ms = round((time.monotonic() - start) * 1000, 1)

        log_entry = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "method": request.method,
            "path": request.url.path,
            "client_ip": get_remote_address(request),
            "status": response.status_code,
            "duration_ms": elapsed_ms,
        }
        audit_logger.info(json.dumps(log_entry, ensure_ascii=False))
        return response


app.add_middleware(AuditLogMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
# ALLOWED_ORIGINS env var: comma-separated list, e.g. "http://localhost:8080,https://example.com"
# Defaults to "*" for development. allow_credentials requires explicit origins (not "*").
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
_credentials = "*" not in _origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(scans.router)
app.include_router(nist.router)
app.include_router(ipgroups.router)
app.include_router(dashboard.router)


@app.get("/")
def root():
    return {
        "service": "SecVision ISMS API",
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
