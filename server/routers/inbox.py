"""
Inbox router — capture & delete quick-capture inbox items.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import get_supabase
from auth import get_current_user_id

router = APIRouter(prefix="/inbox", tags=["inbox"])


class InboxCreate(BaseModel):
    raw_text: str


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
    result = (
        sb.table("inbox_tasks")
        .insert({"user_id": user_id, "raw_text": body.raw_text})
        .execute()
    )
    return result.data[0]


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
