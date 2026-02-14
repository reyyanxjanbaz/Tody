"""
Tody Backend — FastAPI + Supabase

A thin REST layer over your Supabase Postgres tables.
All endpoints require the user's Supabase JWT in the Authorization header.
The server validates it and scopes every query to that user.
"""

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from db import get_supabase, get_service_client
from auth import get_current_user_id
from routers import tasks, categories, inbox, profile

# ── App ──────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: verify Supabase connection
    client = get_service_client()
    print("✓ Connected to Supabase")
    yield

app = FastAPI(
    title="Tody API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────────

app.include_router(tasks.router)
app.include_router(categories.router)
app.include_router(inbox.router)
app.include_router(profile.router)

# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}
