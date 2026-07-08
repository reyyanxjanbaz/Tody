"""
Workspaces router — CRUD for the workspaces table (Phase B).

A workspace groups tasks/categories/habits/inbox captures. Every user has an
implicit "Personal" workspace (client-side, workspace_id = NULL); the rows here
are the *named* workspaces they create. Membership is owner-only until Phase D.

All endpoints require the user's Supabase JWT; queries are scoped to the caller.
"""

import logging, re, uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from typing import Optional, List

from db import get_supabase
from auth import get_current_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/workspaces", tags=["workspaces"])

HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Schemas ──────────────────────────────────────────────────────────────────


class WorkspaceCreate(BaseModel):
    id: Optional[str] = None  # Allow client-generated UUIDs for offline-first sync
    name: str
    icon: str = "albums-outline"
    accent: Optional[str] = None
    sort_order: int = 0

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Workspace name cannot be empty")
        if len(v) > 60:
            raise ValueError("Workspace name must be ≤ 60 characters")
        return v

    @field_validator("accent")
    @classmethod
    def valid_accent(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not HEX_COLOR_RE.match(v):
            raise ValueError("accent must be a valid hex color like #3B82F6")
        return v


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    accent: Optional[str] = None
    sort_order: Optional[int] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Workspace name cannot be empty")
            if len(v) > 60:
                raise ValueError("Workspace name must be ≤ 60 characters")
        return v

    @field_validator("accent")
    @classmethod
    def valid_accent(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not HEX_COLOR_RE.match(v):
            raise ValueError("accent must be a valid hex color like #3B82F6")
        return v


class WorkspaceReorder(BaseModel):
    ordered_ids: List[str]


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("")
def list_workspaces(user_id: str = Depends(get_current_user_id)):
    """All live workspaces the caller belongs to, ordered.

    NOTE: get_supabase() is the service-role client (RLS bypassed), so we scope
    explicitly. The owner is auto-added to workspace_members by a DB trigger, so
    membership is the single source of truth here (works in Phase B and Phase D)."""
    sb = get_supabase()
    memberships = (
        sb.table("workspace_members")
        .select("workspace_id")
        .eq("user_id", user_id)
        .execute()
    )
    ws_ids = [m["workspace_id"] for m in (memberships.data or [])]
    if not ws_ids:
        return []
    result = (
        sb.table("workspaces")
        .select("*")
        .in_("id", ws_ids)
        .is_("deleted_at", "null")
        .order("sort_order")
        .execute()
    )
    return result.data


@router.post("", status_code=201)
def create_workspace(body: WorkspaceCreate, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    data = body.model_dump(exclude_unset=True)
    data["owner_id"] = user_id
    if not data.get("id"):
        data["id"] = str(uuid.uuid4())
    # Upsert so a re-synced client-generated id updates instead of 409-ing.
    logger.info("Creating workspace '%s' for user %s", body.name, user_id[:8])
    result = sb.table("workspaces").upsert(data, on_conflict="id").execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create workspace")
    return result.data[0]


@router.patch("/{workspace_id}")
def update_workspace(
    workspace_id: str,
    body: WorkspaceUpdate,
    user_id: str = Depends(get_current_user_id),
):
    sb = get_supabase()
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = (
        sb.table("workspaces")
        .update(data)
        .eq("id", workspace_id)
        .eq("owner_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return result.data[0]


@router.post("/reorder")
def reorder_workspaces(
    body: WorkspaceReorder,
    user_id: str = Depends(get_current_user_id),
):
    """Update sort_order for the caller's workspaces in one call."""
    sb = get_supabase()
    for i, ws_id in enumerate(body.ordered_ids):
        sb.table("workspaces").update({"sort_order": i}).eq("id", ws_id).eq("owner_id", user_id).execute()
    logger.info("Reordered %d workspaces for user %s", len(body.ordered_ids), user_id[:8])
    result = (
        sb.table("workspaces")
        .select("*")
        .eq("owner_id", user_id)
        .is_("deleted_at", "null")
        .order("sort_order")
        .execute()
    )
    return result.data


@router.delete("/{workspace_id}", status_code=204)
def delete_workspace(workspace_id: str, user_id: str = Depends(get_current_user_id)):
    """Soft-delete a workspace. Its tasks/categories/habits fall back to Personal
    via the ON DELETE SET NULL foreign keys once the row is hard-removed; while
    soft-deleted the client already treats them as Personal (workspace hidden)."""
    sb = get_supabase()
    result = (
        sb.table("workspaces")
        .update({"deleted_at": _now_iso()})
        .eq("id", workspace_id)
        .eq("owner_id", user_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Workspace not found")
    logger.info("Soft-deleted workspace %s for user %s", workspace_id, user_id[:8])
    return None
