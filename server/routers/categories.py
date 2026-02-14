"""
Categories router — CRUD for categories table.

v2 improvements:
  • Input validation (name length, hex color format)
  • Prevent deletion of default categories
  • Batch upsert for sync
  • Reorder endpoint
  • Logging
"""

import logging, re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from typing import Optional, List

from db import get_supabase
from auth import get_current_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/categories", tags=["categories"])

HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

# ── Schemas ──────────────────────────────────────────────────────────────────


class CategoryCreate(BaseModel):
    id: Optional[str] = None  # Allow client-generated UUIDs for sync
    name: str
    icon: str = "grid-outline"
    color: str = "#3B82F6"
    sort_order: int = 0
    is_default: bool = False

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Category name cannot be empty")
        if len(v) > 100:
            raise ValueError("Category name must be ≤ 100 characters")
        return v

    @field_validator("color")
    @classmethod
    def valid_hex_color(cls, v: str) -> str:
        if not HEX_COLOR_RE.match(v):
            raise ValueError("color must be a valid hex color like #3B82F6")
        return v


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Category name cannot be empty")
            if len(v) > 100:
                raise ValueError("Category name must be ≤ 100 characters")
        return v

    @field_validator("color")
    @classmethod
    def valid_hex_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not HEX_COLOR_RE.match(v):
            raise ValueError("color must be a valid hex color like #3B82F6")
        return v


class CategoryReorder(BaseModel):
    """List of category IDs in desired order."""
    ordered_ids: List[str]


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
def list_categories(user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    result = (
        sb.table("categories")
        .select("*")
        .eq("user_id", user_id)
        .order("sort_order")
        .execute()
    )
    return result.data


@router.post("", status_code=201)
def create_category(body: CategoryCreate, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    data = body.model_dump(exclude_unset=True)
    data["user_id"] = user_id
    # Remove None id if not provided
    if not data.get("id"):
        data.pop("id", None)
    logger.info("Creating category '%s' for user %s", body.name, user_id[:8])
    result = sb.table("categories").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create category")
    return result.data[0]


@router.post("/batch", status_code=200)
def batch_upsert_categories(
    categories_list: List[CategoryCreate],
    user_id: str = Depends(get_current_user_id),
):
    """Upsert many categories at once (for sync)."""
    if len(categories_list) > 50:
        raise HTTPException(status_code=400, detail="Max 50 categories per batch")
    sb = get_supabase()
    rows = []
    for c in categories_list:
        data = c.model_dump(exclude_unset=True)
        data["user_id"] = user_id
        if not data.get("id"):
            import uuid
            data["id"] = str(uuid.uuid4())
        rows.append(data)
    if not rows:
        return []
    logger.info("Batch upserting %d categories for user %s", len(rows), user_id[:8])
    result = sb.table("categories").upsert(rows, on_conflict="id").execute()
    return result.data


@router.patch("/{category_id}")
def update_category(
    category_id: str,
    body: CategoryUpdate,
    user_id: str = Depends(get_current_user_id),
):
    sb = get_supabase()
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = (
        sb.table("categories")
        .update(data)
        .eq("id", category_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Category not found")
    return result.data[0]


@router.post("/reorder")
def reorder_categories(
    body: CategoryReorder,
    user_id: str = Depends(get_current_user_id),
):
    """Update sort_order for all categories in one call."""
    sb = get_supabase()
    for i, cat_id in enumerate(body.ordered_ids):
        sb.table("categories").update({"sort_order": i}).eq("id", cat_id).eq("user_id", user_id).execute()
    logger.info("Reordered %d categories for user %s", len(body.ordered_ids), user_id[:8])
    # Return the new ordering
    result = (
        sb.table("categories")
        .select("*")
        .eq("user_id", user_id)
        .order("sort_order")
        .execute()
    )
    return result.data


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: str, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    # Prevent deletion of default categories
    existing = (
        sb.table("categories")
        .select("is_default")
        .eq("id", category_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Category not found")
    if existing.data.get("is_default"):
        raise HTTPException(status_code=400, detail="Cannot delete a default category")

    result = (
        sb.table("categories")
        .delete()
        .eq("id", category_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Category not found")
    logger.info("Deleted category %s for user %s", category_id, user_id[:8])
    return None
