"""
Categories router — CRUD for categories table.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from db import get_supabase
from auth import get_current_user_id

router = APIRouter(prefix="/categories", tags=["categories"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    icon: str = "grid-outline"
    color: str = "#3B82F6"
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None


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
    data = body.model_dump()
    data["user_id"] = user_id
    result = sb.table("categories").insert(data).execute()
    return result.data[0]


@router.patch("/{category_id}")
def update_category(
    category_id: str,
    body: CategoryUpdate,
    user_id: str = Depends(get_current_user_id),
):
    sb = get_supabase()
    data = body.model_dump(exclude_none=True)
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


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: str, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    result = (
        sb.table("categories")
        .delete()
        .eq("id", category_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Category not found")
    return None
