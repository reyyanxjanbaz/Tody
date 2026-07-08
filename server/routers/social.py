"""
Social router — friends, shareable invite codes, and the weekly leaderboard.

All social data is server-authoritative and online-only. Leaderboards are
computed here (never a client-readable view) so weekly XP can be anti-cheated in
one place and task RLS never opens up to friends.

The `invites` table is the single invite machine reused by Phases D (workspace)
and E (pact) — this router owns the friend kind; workspace/pact acceptance is
dispatched from `accept_invite` into their own tables.
"""

import logging, secrets, string, time
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from db import get_supabase, get_service_client
from auth import get_current_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/social", tags=["social"])

# ── XP constants — MUST match web/src/core/utils/profileStats.ts ──────────────
XP_PER_TASK = 10
XP_BONUS_ESTIMATED = 5
XP_BONUS_ON_TIME = 8
XP_PER_LEVEL = 120
# Anti-cheat
MIN_TASK_AGE_SECONDS = 60          # ignore tasks completed <60s after creation
MAX_XP_COMPLETIONS_PER_DAY = 30    # cap XP-earning completions per day

_CODE_ALPHABET = string.ascii_lowercase + string.digits


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _gen_code(n: int = 8) -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(n))


# ── Schemas ──────────────────────────────────────────────────────────────────


class InviteCreate(BaseModel):
    kind: str = "friend"          # 'friend' | 'workspace' | 'pact'
    target_id: Optional[str] = None


class InviteOut(BaseModel):
    code: str
    kind: str
    expires_at: str


# ── Leaderboard cache (per-user, 60s) ─────────────────────────────────────────
_LB_CACHE: dict[str, tuple[float, list]] = {}
_LB_TTL = 60.0


# ── Invites ──────────────────────────────────────────────────────────────────


@router.post("/invites", status_code=201)
def create_invite(body: InviteCreate, user_id: str = Depends(get_current_user_id)):
    if body.kind not in ("friend", "workspace", "pact"):
        raise HTTPException(status_code=400, detail="Invalid invite kind")
    sb = get_supabase()
    # Retry a couple of times on the (astronomically unlikely) code collision.
    for _ in range(3):
        code = _gen_code()
        existing = sb.table("invites").select("code").eq("code", code).execute()
        if not existing.data:
            break
    else:
        raise HTTPException(status_code=500, detail="Could not allocate invite code")

    row = {
        "code": code,
        "inviter_id": user_id,
        "kind": body.kind,
        "target_id": body.target_id,
    }
    result = sb.table("invites").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create invite")
    created = result.data[0]
    logger.info("Created %s invite %s for user %s", body.kind, code, user_id[:8])
    return {"code": created["code"], "kind": created["kind"], "expires_at": created["expires_at"]}


@router.post("/invites/{code}/accept")
def accept_invite(code: str, user_id: str = Depends(get_current_user_id)):
    """Redeem an invite. Uses the service role so it can create the friendship /
    membership across users. Idempotent-ish: re-accepting an already-joined invite
    is a no-op success."""
    sb = get_service_client()
    inv_res = sb.table("invites").select("*").eq("code", code).maybe_single().execute()
    inv = inv_res.data if inv_res else None
    if not inv:
        raise HTTPException(status_code=404, detail="Invite not found")

    # Expiry / usage checks
    expires = inv["expires_at"]
    exp_dt = datetime.fromisoformat(expires.replace("Z", "+00:00")) if isinstance(expires, str) else expires
    if exp_dt is not None and exp_dt < _now():
        raise HTTPException(status_code=410, detail="Invite expired")
    if inv["use_count"] >= inv["max_uses"]:
        raise HTTPException(status_code=410, detail="Invite fully used")

    inviter_id = inv["inviter_id"]
    if inviter_id == user_id and inv["kind"] == "friend":
        raise HTTPException(status_code=400, detail="You can't friend yourself")

    kind = inv["kind"]
    if kind == "friend":
        _create_friendship(sb, inviter_id, user_id)
    elif kind == "workspace":
        _join_workspace(sb, inv["target_id"], user_id)
    elif kind == "pact":
        _join_pact(sb, inv["target_id"], user_id)

    # Bump usage (best-effort; the join above is the important part).
    sb.table("invites").update({"use_count": inv["use_count"] + 1}).eq("code", code).execute()
    logger.info("User %s accepted %s invite %s", user_id[:8], kind, code)
    return {"ok": True, "kind": kind, "target_id": inv.get("target_id")}


def _create_friendship(sb, a: str, b: str) -> None:
    if a == b:
        return
    lo, hi = sorted([a, b])
    sb.table("friendships").upsert(
        {"user_a": lo, "user_b": hi}, on_conflict="user_a,user_b"
    ).execute()


def _join_workspace(sb, workspace_id: Optional[str], user_id: str) -> None:
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Invite has no workspace target")
    sb.table("workspace_members").upsert(
        {"workspace_id": workspace_id, "user_id": user_id, "role": "member"},
        on_conflict="workspace_id,user_id",
    ).execute()


def _join_pact(sb, pact_id: Optional[str], user_id: str) -> None:
    if not pact_id:
        raise HTTPException(status_code=400, detail="Invite has no pact target")
    # Only flips 'invited' → 'accepted', or inserts an accepted participant.
    sb.table("pact_participants").upsert(
        {"pact_id": pact_id, "user_id": user_id, "state": "accepted"},
        on_conflict="pact_id,user_id",
    ).execute()


# ── Friends ──────────────────────────────────────────────────────────────────


@router.get("/friends")
def list_friends(user_id: str = Depends(get_current_user_id)):
    """Friend profiles (id, display_name, avatar_url) for the caller."""
    sb = get_supabase()
    fr = (
        sb.table("friendships")
        .select("user_a,user_b")
        .or_(f"user_a.eq.{user_id},user_b.eq.{user_id}")
        .execute()
    )
    friend_ids = []
    for row in (fr.data or []):
        other = row["user_b"] if row["user_a"] == user_id else row["user_a"]
        friend_ids.append(other)
    if not friend_ids:
        return []
    profs = (
        sb.table("profiles")
        .select("id,display_name,avatar_url")
        .in_("id", friend_ids)
        .execute()
    )
    return profs.data or []


@router.delete("/friends/{friend_id}", status_code=204)
def remove_friend(friend_id: str, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    lo, hi = sorted([user_id, friend_id])
    sb.table("friendships").delete().eq("user_a", lo).eq("user_b", hi).execute()
    logger.info("User %s unfriended %s", user_id[:8], friend_id[:8])
    return None


# ── Leaderboard ──────────────────────────────────────────────────────────────


def _week_start(now: datetime) -> datetime:
    """Monday 00:00 UTC of the current ISO week."""
    monday = now - timedelta(days=now.weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


def _weekly_xp_for_user(sb, uid: str, since_iso: str) -> dict:
    """Server-authoritative weekly XP over tasks completed in [since, now).

    Anti-cheat: skip tasks completed <60s after creation; cap XP-earning
    completions at 30/day; count each task id at most once."""
    res = (
        sb.table("tasks")
        .select("id,completed_at,created_at,estimated_minutes,deadline,is_completed")
        .eq("user_id", uid)
        .eq("is_completed", True)
        .gte("completed_at", since_iso)
        .execute()
    )
    rows = res.data or []
    per_day_count: dict[str, int] = {}
    seen: set[str] = set()
    xp = 0
    tasks_done = 0
    for t in rows:
        tid = t.get("id")
        comp = t.get("completed_at")
        if not tid or tid in seen or not comp:
            continue
        seen.add(tid)
        comp_dt = _parse(comp)
        created_dt = _parse(t.get("created_at"))
        if comp_dt is None:
            continue
        # Anti-cheat: too-fast completion
        if created_dt is not None and (comp_dt - created_dt).total_seconds() < MIN_TASK_AGE_SECONDS:
            continue
        day = comp_dt.date().isoformat()
        if per_day_count.get(day, 0) >= MAX_XP_COMPLETIONS_PER_DAY:
            continue
        per_day_count[day] = per_day_count.get(day, 0) + 1

        tasks_done += 1
        xp += XP_PER_TASK
        est = t.get("estimated_minutes")
        if est is not None and est > 0:
            xp += XP_BONUS_ESTIMATED
        deadline = _parse(t.get("deadline"))
        if deadline is not None and comp_dt <= deadline:
            xp += XP_BONUS_ON_TIME
    return {"weekly_xp": xp, "tasks_completed": tasks_done}


def _parse(v) -> Optional[datetime]:
    if not v:
        return None
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except Exception:
        return None


@router.get("/leaderboard")
def leaderboard(period: str = "week", user_id: str = Depends(get_current_user_id)):
    """Weekly leaderboard for the caller's friend set (+self). Only friends who
    opted into stat sharing are included; the caller always sees their own row."""
    if period != "week":
        raise HTTPException(status_code=400, detail="Only period=week is supported")

    cached = _LB_CACHE.get(user_id)
    if cached and (time.time() - cached[0]) < _LB_TTL:
        return cached[1]

    sb = get_supabase()
    since = _week_start(_now()).isoformat()

    # Friend ids
    fr = (
        sb.table("friendships")
        .select("user_a,user_b")
        .or_(f"user_a.eq.{user_id},user_b.eq.{user_id}")
        .execute()
    )
    friend_ids = []
    for row in (fr.data or []):
        friend_ids.append(row["user_b"] if row["user_a"] == user_id else row["user_a"])

    # Only friends who share stats; caller is always included.
    share_ids = [user_id]
    if friend_ids:
        shares = (
            sb.table("profiles")
            .select("id,share_stats")
            .in_("id", friend_ids)
            .execute()
        )
        share_ids += [p["id"] for p in (shares.data or []) if p.get("share_stats")]

    # Profile cards for all participants
    profs = (
        sb.table("profiles")
        .select("id,display_name,avatar_url")
        .in_("id", share_ids)
        .execute()
    )
    prof_by_id = {p["id"]: p for p in (profs.data or [])}

    board = []
    for uid in share_ids:
        stats = _weekly_xp_for_user(sb, uid, since)
        p = prof_by_id.get(uid, {})
        board.append({
            "user_id": uid,
            "display_name": p.get("display_name") or "Someone",
            "avatar_url": p.get("avatar_url"),
            "weekly_xp": stats["weekly_xp"],
            "tasks_completed": stats["tasks_completed"],
            "is_self": uid == user_id,
        })

    board.sort(key=lambda r: (-r["weekly_xp"], r["display_name"].lower()))
    for i, row in enumerate(board):
        row["rank"] = i + 1

    _LB_CACHE[user_id] = (time.time(), board)
    return board
