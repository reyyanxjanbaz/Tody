"""
Habits router — CRUD + logs + sync for the habit tracker (Phase 5).

Mirrors the tasks router conventions:
  • Pydantic validators for enum fields (schedule_type, energy_level, status)
  • Client-generated UUIDs allowed for offline-first sync
  • Soft delete (deleted_at) so a delete on one device propagates without
    resurrecting the habit on another
  • GET /habits returns { habits, logs } for the current user
  • PUT /habits/{id}/logs/{date} idempotent upsert of a day's log
  • GET /habits/sync?since=<ISO> incremental pull
  • Streak-freeze bank endpoints (server-verified cap of 2)

Day boundaries are the CLIENT's local 'YYYY-MM-DD' day key — the server stores
it verbatim and never recomputes it in UTC.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator

from db import get_supabase
from auth import get_current_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/habits", tags=["habits"])

# ── Allowed enum values ──────────────────────────────────────────────────────

VALID_SCHEDULE = {"daily", "weekdays", "x_per_week"}
VALID_TIME_OF_DAY = {"anytime", "morning", "afternoon", "evening"}
VALID_ENERGY = {"high", "medium", "low"}
VALID_LOG_STATUS = {"done", "skipped", "frozen"}
MAX_FREEZES = 2


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Schemas ──────────────────────────────────────────────────────────────────


class HabitCreate(BaseModel):
    id: Optional[str] = None
    name: str
    icon: str = "flame-outline"
    color: str = "#F59E0B"
    schedule_type: str = "daily"
    schedule_days: List[int] = []
    schedule_target: int = 1
    time_of_day: str = "anytime"
    energy_level: str = "medium"
    tiny_version: str = ""
    reminder_time: Optional[str] = None
    order: int = 0
    workspace_id: Optional[str] = None  # NULL = Personal workspace
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    archived_at: Optional[str] = None
    deleted_at: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name cannot be empty")
        return v.strip()

    @field_validator("schedule_type")
    @classmethod
    def validate_schedule(cls, v: str) -> str:
        if v not in VALID_SCHEDULE:
            raise ValueError(f"schedule_type must be one of {VALID_SCHEDULE}")
        return v

    @field_validator("time_of_day")
    @classmethod
    def validate_time(cls, v: str) -> str:
        if v not in VALID_TIME_OF_DAY:
            raise ValueError(f"time_of_day must be one of {VALID_TIME_OF_DAY}")
        return v

    @field_validator("energy_level")
    @classmethod
    def validate_energy(cls, v: str) -> str:
        if v not in VALID_ENERGY:
            raise ValueError(f"energy_level must be one of {VALID_ENERGY}")
        return v

    @field_validator("schedule_target")
    @classmethod
    def validate_target(cls, v: int) -> int:
        if v < 1 or v > 7:
            raise ValueError("schedule_target must be between 1 and 7")
        return v

    @field_validator("schedule_days")
    @classmethod
    def validate_days(cls, v: List[int]) -> List[int]:
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("schedule_days must be weekday indexes 0..6")
        return v


class HabitUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    schedule_type: Optional[str] = None
    schedule_days: Optional[List[int]] = None
    schedule_target: Optional[int] = None
    time_of_day: Optional[str] = None
    energy_level: Optional[str] = None
    tiny_version: Optional[str] = None
    reminder_time: Optional[str] = None
    order: Optional[int] = None
    workspace_id: Optional[str] = None
    archived_at: Optional[str] = None


class HabitLogUpsert(BaseModel):
    status: str = "done"
    completed_at: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_LOG_STATUS:
            raise ValueError(f"status must be one of {VALID_LOG_STATUS}")
        return v


# ── Habits CRUD ──────────────────────────────────────────────────────────────


@router.get("")
def list_habits(
    include_logs: bool = True,
    logs_from: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
):
    """Return the user's live habits and (optionally) their logs."""
    sb = get_supabase()
    habits = (
        sb.table("habits")
        .select("*")
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .order("order")
        .execute()
    )
    payload = {"habits": habits.data, "logs": []}
    if include_logs:
        q = sb.table("habit_logs").select("*").eq("user_id", user_id)
        if logs_from:
            q = q.gte("date", logs_from)
        payload["logs"] = q.execute().data
    return payload


@router.get("/sync")
def sync_habits(since: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    """Incremental pull: habits + logs changed since an ISO timestamp."""
    sb = get_supabase()
    hq = sb.table("habits").select("*").eq("user_id", user_id).order("updated_at", desc=True)
    lq = sb.table("habit_logs").select("*").eq("user_id", user_id)
    if since:
        hq = hq.gte("updated_at", since)
        lq = lq.gte("completed_at", since)
    return {"habits": hq.execute().data, "logs": lq.execute().data}


@router.post("", status_code=201)
def create_habit(body: HabitCreate, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    data = body.model_dump(exclude_unset=True)
    data["user_id"] = user_id
    if not data.get("id"):
        data["id"] = str(uuid.uuid4())
    data.setdefault("created_at", _now_iso())
    data["updated_at"] = _now_iso()
    # Upsert so a re-synced client-generated id updates instead of 409-ing.
    result = sb.table("habits").upsert(data, on_conflict="id").execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create habit")
    return result.data[0]


@router.patch("/{habit_id}")
def update_habit(habit_id: str, body: HabitUpdate, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    data["updated_at"] = _now_iso()
    result = (
        sb.table("habits").update(data).eq("id", habit_id).eq("user_id", user_id).execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Habit not found")
    return result.data[0]


@router.delete("/{habit_id}", status_code=204)
def delete_habit(habit_id: str, user_id: str = Depends(get_current_user_id)):
    """Soft delete so the deletion propagates cross-device (no resurrection)."""
    sb = get_supabase()
    now = _now_iso()
    sb.table("habits").update({"deleted_at": now, "updated_at": now}).eq("id", habit_id).eq(
        "user_id", user_id
    ).execute()


# ── Habit logs ───────────────────────────────────────────────────────────────


@router.put("/{habit_id}/logs/{date}")
def upsert_log(
    habit_id: str,
    date: str,
    body: HabitLogUpsert,
    user_id: str = Depends(get_current_user_id),
):
    """Idempotent upsert of one day's log (UNIQUE on habit_id, date)."""
    sb = get_supabase()
    row = {
        "user_id": user_id,
        "habit_id": habit_id,
        "date": date,
        "status": body.status,
        "completed_at": body.completed_at or _now_iso(),
    }
    result = sb.table("habit_logs").upsert(row, on_conflict="habit_id,date").execute()
    return result.data[0] if result.data else row


@router.delete("/{habit_id}/logs/{date}", status_code=204)
def delete_log(habit_id: str, date: str, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    sb.table("habit_logs").delete().eq("habit_id", habit_id).eq("date", date).eq(
        "user_id", user_id
    ).execute()


# ── Streak-freeze bank (server-verified cap) ─────────────────────────────────


@router.post("/freezes/{action}")
def adjust_freezes(action: str, user_id: str = Depends(get_current_user_id)):
    """Earn or consume a streak freeze, enforcing the bank cap server-side."""
    if action not in {"earn", "consume"}:
        raise HTTPException(status_code=400, detail="action must be 'earn' or 'consume'")
    sb = get_supabase()
    prof = (
        sb.table("profiles").select("streak_freezes").eq("id", user_id).maybe_single().execute()
    )
    current = (prof.data or {}).get("streak_freezes", 0) or 0
    if action == "earn":
        nxt = min(MAX_FREEZES, current + 1)
    else:
        nxt = max(0, current - 1)
    sb.table("profiles").update({"streak_freezes": nxt}).eq("id", user_id).execute()
    return {"streak_freezes": nxt}
