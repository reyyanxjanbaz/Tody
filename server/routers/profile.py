"""
Profile router — get/update profile, get stats, get detailed analytics.

v2 improvements:
  • display_name support
  • Input validation for enum fields
  • Enhanced stats endpoint with extra metrics
  • GET /profile/analytics — streaks, completion trends, category breakdown
  • Logging
"""

import logging
from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from typing import Optional

from db import get_supabase
from auth import get_current_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/profile", tags=["profile"])

VALID_DATE_FORMATS = {"MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"}
VALID_TIME_FORMATS = {"12h", "24h"}
VALID_WEEK_STARTS = {"sunday", "monday"}


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    dark_mode: Optional[bool] = None
    date_format: Optional[str] = None
    time_format: Optional[str] = None
    week_starts_on: Optional[str] = None

    @field_validator("date_format")
    @classmethod
    def valid_date_format(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_DATE_FORMATS:
            raise ValueError(f"date_format must be one of {VALID_DATE_FORMATS}")
        return v

    @field_validator("time_format")
    @classmethod
    def valid_time_format(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_TIME_FORMATS:
            raise ValueError(f"time_format must be one of {VALID_TIME_FORMATS}")
        return v

    @field_validator("week_starts_on")
    @classmethod
    def valid_week_start(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_WEEK_STARTS:
            raise ValueError(f"week_starts_on must be one of {VALID_WEEK_STARTS}")
        return v


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
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    logger.info("Updating profile for user %s: %s", user_id[:8], list(data.keys()))
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
            "total_archived": 0,
            "total_deferred": 0,
            "last_completed_at": None,
            "active_days": 0,
        }
    return result.data


@router.get("/analytics")
def get_analytics(
    days: int = 30,
    user_id: str = Depends(get_current_user_id),
):
    """
    Rich analytics: category breakdown, daily completion trend,
    streaks, priority distribution, energy distribution.
    """
    sb = get_supabase()
    since = (datetime.utcnow() - timedelta(days=days)).isoformat()

    # Fetch all tasks for the user (we need full history for streaks)
    all_tasks_result = (
        sb.table("tasks")
        .select("id, is_completed, completed_at, priority, energy_level, category_id, created_at, actual_minutes, defer_count")
        .eq("user_id", user_id)
        .execute()
    )
    all_tasks = all_tasks_result.data or []

    # Recent tasks (for period-specific stats)
    recent_tasks = [
        t for t in all_tasks
        if t.get("created_at", "") >= since or (t.get("completed_at") and t["completed_at"] >= since)
    ]

    # ── Streaks ──────────────────────────────────────────────────────────
    completed_days = set()
    for t in all_tasks:
        if t.get("is_completed") and t.get("completed_at"):
            day = t["completed_at"][:10]  # "YYYY-MM-DD"
            completed_days.add(day)

    sorted_days = sorted(completed_days)
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    yesterday_str = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")

    current_streak = 0
    if today_str in completed_days:
        current_streak = 1
        check = datetime.utcnow() - timedelta(days=1)
        while check.strftime("%Y-%m-%d") in completed_days:
            current_streak += 1
            check -= timedelta(days=1)
    elif yesterday_str in completed_days:
        current_streak = 1
        check = datetime.utcnow() - timedelta(days=2)
        while check.strftime("%Y-%m-%d") in completed_days:
            current_streak += 1
            check -= timedelta(days=1)

    best_streak = 0
    if sorted_days:
        run = 1
        for i in range(1, len(sorted_days)):
            d1 = datetime.strptime(sorted_days[i - 1], "%Y-%m-%d")
            d2 = datetime.strptime(sorted_days[i], "%Y-%m-%d")
            if (d2 - d1).days == 1:
                run += 1
            else:
                best_streak = max(best_streak, run)
                run = 1
        best_streak = max(best_streak, run)

    # ── Priority distribution ────────────────────────────────────────────
    priority_dist = defaultdict(int)
    for t in recent_tasks:
        priority_dist[t.get("priority", "none")] += 1

    # ── Energy distribution ──────────────────────────────────────────────
    energy_dist = defaultdict(int)
    for t in recent_tasks:
        energy_dist[t.get("energy_level", "medium")] += 1

    # ── Category breakdown ───────────────────────────────────────────────
    cat_stats: dict = defaultdict(lambda: {"total": 0, "completed": 0})
    for t in recent_tasks:
        cid = t.get("category_id") or "uncategorized"
        cat_stats[cid]["total"] += 1
        if t.get("is_completed"):
            cat_stats[cid]["completed"] += 1

    # ── Daily trend (last N days) ────────────────────────────────────────
    daily_trend = []
    for i in range(days):
        day = (datetime.utcnow() - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        created = sum(1 for t in all_tasks if t.get("created_at", "")[:10] == day)
        completed = sum(1 for t in all_tasks if t.get("is_completed") and t.get("completed_at", "")[:10] == day)
        daily_trend.append({"date": day, "created": created, "completed": completed})

    return {
        "period_days": days,
        "current_streak": current_streak,
        "best_streak": best_streak,
        "priority_distribution": dict(priority_dist),
        "energy_distribution": dict(energy_dist),
        "category_breakdown": dict(cat_stats),
        "daily_trend": daily_trend,
        "total_tasks_in_period": len(recent_tasks),
        "completed_in_period": sum(1 for t in recent_tasks if t.get("is_completed")),
    }
