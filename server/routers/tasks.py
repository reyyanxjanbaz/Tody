"""
Tasks router — CRUD + sync + batch operations for the tasks table.

v2 improvements:
  • Pydantic validators for enum fields (priority, energy_level, etc.)
  • Proper nullable-field handling (exclude_unset instead of exclude_none)
  • Auto-set completed_at when is_completed flips to true
  • Pagination via limit / offset
  • GET /tasks/sync?since=<ISO-timestamp> for incremental sync
  • POST /tasks/batch for upserting many tasks at once
  • POST /tasks/{id}/archive and /tasks/{id}/defer convenience endpoints
  • Structured logging on every mutation
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime

from db import get_supabase
from auth import get_current_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tasks", tags=["tasks"])

# ── Allowed enum values ──────────────────────────────────────────────────────

VALID_PRIORITIES = {"high", "medium", "low", "none"}
VALID_ENERGY = {"high", "medium", "low"}
VALID_RECURRING = {"daily", "weekly", "biweekly", "monthly"}

# ── Schemas ──────────────────────────────────────────────────────────────────


class TaskCreate(BaseModel):
    id: Optional[str] = None  # Allow client-generated UUIDs for sync
    title: str
    description: str = ""
    priority: str = "none"
    energy_level: str = "medium"
    category_id: Optional[str] = None
    deadline: Optional[str] = None  # ISO timestamp string
    is_recurring: bool = False
    recurring_frequency: Optional[str] = None
    estimated_minutes: Optional[int] = None
    parent_id: Optional[str] = None
    depth: int = 0
    created_hour: int = 0
    # Fields that may come from the frontend during sync
    is_completed: bool = False
    completed_at: Optional[str] = None
    is_archived: bool = False
    archived_at: Optional[str] = None
    overdue_start_date: Optional[str] = None
    revived_at: Optional[str] = None
    started_at: Optional[str] = None
    actual_minutes: Optional[int] = None
    defer_count: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        if v not in VALID_PRIORITIES:
            raise ValueError(f"priority must be one of {VALID_PRIORITIES}")
        return v

    @field_validator("energy_level")
    @classmethod
    def validate_energy(cls, v: str) -> str:
        if v not in VALID_ENERGY:
            raise ValueError(f"energy_level must be one of {VALID_ENERGY}")
        return v

    @field_validator("recurring_frequency")
    @classmethod
    def validate_recurring(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_RECURRING:
            raise ValueError(f"recurring_frequency must be one of {VALID_RECURRING}")
        return v

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("title cannot be empty")
        return v.strip()

    @field_validator("depth")
    @classmethod
    def depth_range(cls, v: int) -> int:
        if v < 0 or v > 3:
            raise ValueError("depth must be between 0 and 3")
        return v

    @field_validator("created_hour")
    @classmethod
    def hour_range(cls, v: int) -> int:
        if v < 0 or v > 23:
            raise ValueError("created_hour must be between 0 and 23")
        return v

    @field_validator("estimated_minutes")
    @classmethod
    def positive_estimate(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError("estimated_minutes must be > 0")
        return v


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    energy_level: Optional[str] = None
    category_id: Optional[str] = None
    deadline: Optional[str] = None
    is_completed: Optional[bool] = None
    completed_at: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurring_frequency: Optional[str] = None
    defer_count: Optional[int] = None
    overdue_start_date: Optional[str] = None
    revived_at: Optional[str] = None
    archived_at: Optional[str] = None
    is_archived: Optional[bool] = None
    estimated_minutes: Optional[int] = None
    actual_minutes: Optional[int] = None
    started_at: Optional[str] = None
    parent_id: Optional[str] = None
    depth: Optional[int] = None

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_PRIORITIES:
            raise ValueError(f"priority must be one of {VALID_PRIORITIES}")
        return v

    @field_validator("energy_level")
    @classmethod
    def validate_energy(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_ENERGY:
            raise ValueError(f"energy_level must be one of {VALID_ENERGY}")
        return v

    @field_validator("recurring_frequency")
    @classmethod
    def validate_recurring(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_RECURRING:
            raise ValueError(f"recurring_frequency must be one of {VALID_RECURRING}")
        return v

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("title cannot be empty")
        return v.strip() if v else v

    @field_validator("depth")
    @classmethod
    def depth_range(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 0 or v > 3):
            raise ValueError("depth must be between 0 and 3")
        return v


# ── Helpers ──────────────────────────────────────────────────────────────────

def _auto_complete_fields(data: dict) -> dict:
    """
    If is_completed is being set to True and completed_at isn't provided,
    auto-set completed_at to now().  Similarly for archiving.
    """
    if data.get("is_completed") is True and not data.get("completed_at"):
        data["completed_at"] = datetime.utcnow().isoformat()
    if data.get("is_completed") is False:
        data.pop("completed_at", None)
        data["completed_at"] = None
    if data.get("is_archived") is True and not data.get("archived_at"):
        data["archived_at"] = datetime.utcnow().isoformat()
    if data.get("is_archived") is False:
        data.pop("archived_at", None)
        data["archived_at"] = None
    return data


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
def list_tasks(
    archived: bool = False,
    completed: Optional[bool] = None,
    category_id: Optional[str] = None,
    priority: Optional[str] = None,
    energy_level: Optional[str] = None,
    limit: int = Query(default=500, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(get_current_user_id),
):
    """
    Get tasks for the current user with optional filters & pagination.
    """
    sb = get_supabase()
    query = (
        sb.table("tasks")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_archived", archived)
        .order("created_at", desc=True)
        .limit(limit)
        .offset(offset)
    )
    if completed is not None:
        query = query.eq("is_completed", completed)
    if category_id:
        query = query.eq("category_id", category_id)
    if priority and priority in VALID_PRIORITIES:
        query = query.eq("priority", priority)
    if energy_level and energy_level in VALID_ENERGY:
        query = query.eq("energy_level", energy_level)

    result = query.execute()
    return result.data


@router.get("/sync")
def sync_tasks(
    since: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
):
    """
    Incremental sync: returns all tasks updated since the given ISO timestamp.
    If `since` is omitted, returns ALL tasks (full sync).
    """
    sb = get_supabase()
    query = (
        sb.table("tasks")
        .select("*")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
    )
    if since:
        query = query.gte("updated_at", since)

    result = query.execute()
    return result.data


@router.get("/{task_id}")
def get_task(task_id: str, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    result = (
        sb.table("tasks")
        .select("*")
        .eq("id", task_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return result.data


@router.post("", status_code=201)
def create_task(body: TaskCreate, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    data = body.model_dump(exclude_unset=True)
    data["user_id"] = user_id
    data = _auto_complete_fields(data)
    # Remove None values for optional fields that weren't set
    data = {k: v for k, v in data.items() if v is not None}
    logger.info("Creating task '%s' for user %s", body.title, user_id[:8])
    result = sb.table("tasks").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create task")
    return result.data[0]


@router.post("/batch", status_code=200)
def batch_upsert_tasks(
    tasks_list: List[TaskCreate],
    user_id: str = Depends(get_current_user_id),
):
    """
    Upsert many tasks at once (for initial sync from local → cloud).
    Each task must have an `id`.  Existing rows are updated; new ones inserted.
    Returns the upserted rows.
    """
    if len(tasks_list) > 200:
        raise HTTPException(status_code=400, detail="Max 200 tasks per batch")

    sb = get_supabase()
    rows = []
    for t in tasks_list:
        data = t.model_dump(exclude_unset=True)
        data["user_id"] = user_id
        data = _auto_complete_fields(data)
        # Ensure an id exists for upsert
        if not data.get("id"):
            import uuid
            data["id"] = str(uuid.uuid4())
        rows.append(data)

    if not rows:
        return []

    logger.info("Batch upserting %d tasks for user %s", len(rows), user_id[:8])
    result = sb.table("tasks").upsert(rows, on_conflict="id").execute()
    return result.data


@router.patch("/{task_id}")
def update_task(
    task_id: str,
    body: TaskUpdate,
    user_id: str = Depends(get_current_user_id),
):
    sb = get_supabase()
    # Use exclude_unset so explicitly-passed null values ARE included
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    data = _auto_complete_fields(data)
    logger.info("Updating task %s for user %s: %s", task_id, user_id[:8], list(data.keys()))
    result = (
        sb.table("tasks")
        .update(data)
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return result.data[0]


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: str, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    # First delete children (cascade one level — Supabase SET NULL won't cascade deletes)
    sb.table("tasks").delete().eq("parent_id", task_id).eq("user_id", user_id).execute()
    result = (
        sb.table("tasks")
        .delete()
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    logger.info("Deleted task %s for user %s", task_id, user_id[:8])
    return None


@router.delete("", status_code=204)
def batch_delete_tasks(
    task_ids: List[str] = Query(...),
    user_id: str = Depends(get_current_user_id),
):
    """Delete multiple tasks by ID."""
    if len(task_ids) > 200:
        raise HTTPException(status_code=400, detail="Max 200 task IDs per batch delete")
    sb = get_supabase()
    sb.table("tasks").delete().in_("id", task_ids).eq("user_id", user_id).execute()
    logger.info("Batch deleted %d tasks for user %s", len(task_ids), user_id[:8])
    return None


@router.get("/{task_id}/children")
def get_children(task_id: str, user_id: str = Depends(get_current_user_id)):
    """Get all direct child tasks of a given task."""
    sb = get_supabase()
    result = (
        sb.table("tasks")
        .select("*")
        .eq("parent_id", task_id)
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
    )
    return result.data


class TaskCompleteBody(BaseModel):
    """Optional body for the /complete convenience endpoint."""
    actual_minutes: Optional[int] = None


@router.post("/{task_id}/complete")
def complete_task(
    task_id: str,
    body: TaskCompleteBody = TaskCompleteBody(),
    user_id: str = Depends(get_current_user_id),
):
    """Convenience: mark a task as completed.  Optionally records actual_minutes."""
    sb = get_supabase()
    now = datetime.utcnow().isoformat()
    update_data: dict = {"is_completed": True, "completed_at": now, "updated_at": now}
    if body.actual_minutes is not None:
        update_data["actual_minutes"] = body.actual_minutes
    result = (
        sb.table("tasks")
        .update(update_data)
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    logger.info("Completed task %s for user %s", task_id, user_id[:8])
    return result.data[0]


@router.post("/{task_id}/uncomplete")
def uncomplete_task(task_id: str, user_id: str = Depends(get_current_user_id)):
    """Convenience: un-complete a task."""
    sb = get_supabase()
    now = datetime.utcnow().isoformat()
    result = (
        sb.table("tasks")
        .update({"is_completed": False, "completed_at": None, "actual_minutes": None, "updated_at": now})
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    logger.info("Uncompleted task %s for user %s", task_id, user_id[:8])
    return result.data[0]


@router.post("/{task_id}/archive")
def archive_task(task_id: str, user_id: str = Depends(get_current_user_id)):
    """Convenience: archive a task."""
    sb = get_supabase()
    now = datetime.utcnow().isoformat()
    result = (
        sb.table("tasks")
        .update({"is_archived": True, "archived_at": now, "updated_at": now})
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    logger.info("Archived task %s for user %s", task_id, user_id[:8])
    return result.data[0]


@router.post("/{task_id}/defer")
def defer_task(task_id: str, user_id: str = Depends(get_current_user_id)):
    """Convenience: defer a task to tomorrow, increment defer_count."""
    sb = get_supabase()
    # Fetch current defer_count
    existing = (
        sb.table("tasks")
        .select("defer_count")
        .eq("id", task_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Task not found")

    from datetime import timedelta
    tomorrow = datetime.utcnow().replace(hour=23, minute=59, second=59) + timedelta(days=1)
    new_count = (existing.data.get("defer_count") or 0) + 1

    result = (
        sb.table("tasks")
        .update({
            "deadline": tomorrow.isoformat(),
            "defer_count": new_count,
            "overdue_start_date": None,
        })
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0]
