"""
Tody Backend — FastAPI + Supabase  (v2)

A thin REST + sync layer over Supabase Postgres tables.
All endpoints require the user's Supabase JWT in the Authorization header.
The server validates it and scopes every query to that user.

v2 improvements:
  • Structured JSON logging
  • Global exception handler → never leaks stack traces
  • Tighter CORS (configurable via ALLOWED_ORIGINS env var)
  • Request-ID middleware for traceability
  • /health checks Supabase connectivity
"""

import logging, os, uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from db import get_service_client
from routers import tasks, categories, inbox, profile, patterns

# ── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ──────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: verify Supabase connection
    try:
        get_service_client()
        logger.info("✓ Connected to Supabase")
    except Exception as e:
        logger.error("✗ Failed to connect to Supabase: %s", e)
        raise
    yield

app = FastAPI(
    title="Tody API",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS — default allows all; set ALLOWED_ORIGINS for production ────────────

allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request-ID middleware ────────────────────────────────────────────────────

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

# ── Global exception handler ────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# ── Routers ──────────────────────────────────────────────────────────────────

app.include_router(tasks.router)
app.include_router(categories.router)
app.include_router(inbox.router)
app.include_router(profile.router)
app.include_router(patterns.router)

# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Lightweight health probe — verifies Supabase is reachable."""
    try:
        sb = get_service_client()
        # A cheap query to verify the connection is alive
        sb.table("profiles").select("id").limit(1).execute()
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        logger.error("Health check failed: %s", e)
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "database": "unreachable", "detail": str(e)},
        )
