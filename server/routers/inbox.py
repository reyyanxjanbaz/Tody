"""
Inbox router — capture, list, convert, and delete quick-capture inbox items.

v2 improvements:
  • Input validation (max length)
  • POST /inbox/{id}/convert — convert an inbox item to a real task
  • POST /inbox/batch — batch upsert for sync
  • DELETE /inbox (batch delete)
  • Logging
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime

from db import get_supabase
from auth import get_current_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/inbox", tags=["inbox"])


class InboxCreate(BaseModel):
    id: Optional[str] = None  # Allow client-generated UUIDs for sync
    raw_text: str
    captured_at: Optional[str] = None

    @field_validator("raw_text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("raw_text cannot be empty")
        if len(v) > 1000:
            raise ValueError("raw_text must be ≤ 1000 characters")
        return v


class InboxConvert(BaseModel):
    """Minimal fields to promote an inbox item to a real task."""
    title: Optional[str] = None  # Defaults to raw_text if omitted
    priority: str = "none"
    energy_level: str = "medium"
    category_id: Optional[str] = None
    deadline: Optional[str] = None
    estimated_minutes: Optional[int] = None
    is_completed: bool = False   # True → create task as already-completed (quick-complete flow)


@router.get("")
def list_inbox(user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    result = (
        sb.table("inbox_tasks")
        .select("*")
        .eq("user_id", user_id)
        .order("captured_at", desc=True)
        .execute()
    )
    return result.data


@router.post("", status_code=201)
def capture_inbox(body: InboxCreate, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    data: dict = {"user_id": user_id, "raw_text": body.raw_text}
    if body.id:
        data["id"] = body.id
    if body.captured_at:
        data["captured_at"] = body.captured_at
    result = (
        sb.table("inbox_tasks")
        .insert(data)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to capture inbox item")
    logger.info("Captured inbox item for user %s", user_id[:8])
    return result.data[0]


@router.post("/batch", status_code=200)
def batch_upsert_inbox(
    items: List[InboxCreate],
    user_id: str = Depends(get_current_user_id),
):
    """Upsert many inbox items at once (for sync)."""
    if len(items) > 100:
        raise HTTPException(status_code=400, detail="Max 100 inbox items per batch")
    sb = get_supabase()
    rows = []
    for item in items:
        data: dict = {"user_id": user_id, "raw_text": item.raw_text}
        if item.id:
            data["id"] = item.id
        else:
            import uuid
            data["id"] = str(uuid.uuid4())
        if item.captured_at:
            data["captured_at"] = item.captured_at
        rows.append(data)
    if not rows:
        return []
    logger.info("Batch upserting %d inbox items for user %s", len(rows), user_id[:8])
    result = sb.table("inbox_tasks").upsert(rows, on_conflict="id").execute()
    return result.data


@router.post("/{inbox_id}/convert", status_code=201)
def convert_inbox_to_task(
    inbox_id: str,
    body: InboxConvert,
    user_id: str = Depends(get_current_user_id),
):
    """
    Promote an inbox item to a real task, then delete the inbox entry.
    """
    sb = get_supabase()

    # 1. Fetch the inbox item
    inbox_result = (
        sb.table("inbox_tasks")
        .select("*")
        .eq("id", inbox_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not inbox_result.data:
        raise HTTPException(status_code=404, detail="Inbox item not found")

    inbox_item = inbox_result.data
    title = (body.title or inbox_item["raw_text"]).strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")

    # 2. Create the task
    task_data = {
        "user_id":      user_id,
        "title":        title,
        "priority":     body.priority,
        "energy_level": body.energy_level,
        "created_hour": datetime.utcnow().hour,
    }
    if body.category_id:       task_data["category_id"]       = body.category_id
    if body.deadline:          task_data["deadline"]           = body.deadline
    if body.estimated_minutes: task_data["estimated_minutes"]  = body.estimated_minutes

    # Support quick-complete flow: mark task as done on creation
    if body.is_completed:
        task_data["is_completed"] = True
        task_data["completed_at"] = datetime.utcnow().isoformat()

    task_result = sb.table("tasks").insert(task_data).execute()
    if not task_result.data:
        raise HTTPException(status_code=500, detail="Failed to create task from inbox")

    # 3. Delete the inbox item
    sb.table("inbox_tasks").delete().eq("id", inbox_id).eq("user_id", user_id).execute()

    logger.info(
        "Converted inbox %s → task %s (completed=%s) for user %s",
        inbox_id, task_result.data[0]["id"], body.is_completed, user_id[:8],
    )
    return task_result.data[0]


@router.delete("/{inbox_id}", status_code=204)
def delete_inbox(inbox_id: str, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    result = (
        sb.table("inbox_tasks")
        .delete()
        .eq("id", inbox_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Inbox item not found")
    return None


@router.delete("", status_code=204)
def batch_delete_inbox(
    inbox_ids: List[str] = Query(...),
    user_id: str = Depends(get_current_user_id),
):
    """Delete multiple inbox items by ID."""
    if len(inbox_ids) > 100:
        raise HTTPException(status_code=400, detail="Max 100 IDs per batch delete")
    sb = get_supabase()
    sb.table("inbox_tasks").delete().in_("id", inbox_ids).eq("user_id", user_id).execute()
    logger.info("Batch deleted %d inbox items for user %s", len(inbox_ids), user_id[:8])
    return None
