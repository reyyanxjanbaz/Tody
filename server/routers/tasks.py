"""
Tasks router — CRUD for tasks table.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from db import get_supabase
from auth import get_current_user_id

router = APIRouter(prefix="/tasks", tags=["tasks"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    priority: str = "none"
    energy_level: str = "medium"
    category_id: Optional[str] = None
    deadline: Optional[datetime] = None
    is_recurring: bool = False
    recurring_frequency: Optional[str] = None
    estimated_minutes: Optional[int] = None
    parent_id: Optional[str] = None
    depth: int = 0
    created_hour: int = 0


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    energy_level: Optional[str] = None
    category_id: Optional[str] = None
    deadline: Optional[datetime] = None
    is_completed: Optional[bool] = None
    completed_at: Optional[datetime] = None
    is_recurring: Optional[bool] = None
    recurring_frequency: Optional[str] = None
    defer_count: Optional[int] = None
    overdue_start_date: Optional[datetime] = None
    revived_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None
    is_archived: Optional[bool] = None
    estimated_minutes: Optional[int] = None
    actual_minutes: Optional[int] = None
    started_at: Optional[datetime] = None
    parent_id: Optional[str] = None
    depth: Optional[int] = None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
def list_tasks(
    archived: bool = False,
    user_id: str = Depends(get_current_user_id),
):
    """Get all tasks for the current user. Use ?archived=true for archived tasks."""
    sb = get_supabase()
    query = (
        sb.table("tasks")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_archived", archived)
        .order("created_at", desc=True)
    )
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
    data = body.model_dump(exclude_none=True)
    data["user_id"] = user_id
    result = sb.table("tasks").insert(data).execute()
    return result.data[0]


@router.patch("/{task_id}")
def update_task(
    task_id: str,
    body: TaskUpdate,
    user_id: str = Depends(get_current_user_id),
):
    sb = get_supabase()
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
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
    result = (
        sb.table("tasks")
        .delete()
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
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
