"""
Profile router — get/update profile, get stats.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from db import get_supabase
from auth import get_current_user_id

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    avatar_url: Optional[str] = None
    dark_mode: Optional[bool] = None
    date_format: Optional[str] = None
    time_format: Optional[str] = None
    week_starts_on: Optional[str] = None


@router.get("")
def get_profile(user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    result = (
        sb.table("profiles")
        .select("*")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data


@router.patch("")
def update_profile(body: ProfileUpdate, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = (
        sb.table("profiles")
        .update(data)
        .eq("id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data[0]


@router.get("/stats")
def get_stats(user_id: str = Depends(get_current_user_id)):
    """Quick stats from the user_task_stats view."""
    sb = get_supabase()
    result = (
        sb.table("user_task_stats")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    # Return zeros if user has no tasks yet
    if not result.data:
        return {
            "user_id": user_id,
            "total_created": 0,
            "total_completed": 0,
            "total_incomplete": 0,
            "total_minutes_spent": 0,
            "avg_minutes_per_task": 0,
            "completion_percentage": 0,
        }
    return result.data
