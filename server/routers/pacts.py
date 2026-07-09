"""
Pacts router — group commitment tasks (Phase E).

A pact completes only when every participating member has completed their part.
Pacts are server-authoritative: the "all done" decision lives in the Postgres
RPC complete_pact_participation() (row-locked, race-safe). This router is the
CRUD + lifecycle surface; clients subscribe to Realtime for live progress.
"""

import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, field_validator
from typing import Optional, List

from db import get_supabase, get_service_client
from auth import get_current_user_id
from push import send_push, display_name

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pacts", tags=["pacts"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse(v) -> Optional[datetime]:
    if not v:
        return None
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except Exception:
        return None


# ── Schemas ──────────────────────────────────────────────────────────────────


class PactCreate(BaseModel):
    title: str
    description: str = ""
    deadline: Optional[str] = None

    @field_validator("title")
    @classmethod
    def title_ok(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        if len(v) > 500:
            raise ValueError("Title must be ≤ 500 characters")
        return v


# ── Helpers ──────────────────────────────────────────────────────────────────


def _pact_payload(sb, pact_id: str) -> dict:
    """A pact plus its participants, as the client expects it."""
    pact = sb.table("pacts").select("*").eq("id", pact_id).maybe_single().execute()
    if not pact.data:
        raise HTTPException(status_code=404, detail="Pact not found")
    parts = sb.table("pact_participants").select("*").eq("pact_id", pact_id).execute()
    rows = parts.data or []
    ids = [r["user_id"] for r in rows]
    profs = {}
    if ids:
        pr = sb.table("profiles").select("id,display_name,avatar_url").in_("id", ids).execute()
        profs = {p["id"]: p for p in (pr.data or [])}
    participants = [
        {
            "user_id": r["user_id"],
            "state": r["state"],
            "done_at": r.get("done_at"),
            "display_name": profs.get(r["user_id"], {}).get("display_name"),
            "avatar_url": profs.get(r["user_id"], {}).get("avatar_url"),
        }
        for r in rows
    ]
    return {**pact.data, "participants": participants}


def _maybe_expire(sb, pact: dict) -> dict:
    """Lazily flip an active, past-deadline pact to 'expired' on read."""
    if pact.get("status") == "active" and pact.get("deadline"):
        dl = _parse(pact["deadline"])
        if dl is not None and dl < _now():
            sb.table("pacts").update({"status": "expired"}).eq("id", pact["id"]).eq("status", "active").execute()
            pact["status"] = "expired"
    return pact


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("", status_code=201)
def create_pact(body: PactCreate, user_id: str = Depends(get_current_user_id)):
    """Create a pact, add the creator as a participant, and mint an invite code."""
    sb = get_supabase()
    pact_row = {
        "creator_id": user_id,
        "title": body.title,
        "description": body.description,
        "deadline": body.deadline,
    }
    res = sb.table("pacts").insert(pact_row).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create pact")
    pact = res.data[0]

    # Creator is a participant (accepted).
    sb.table("pact_participants").upsert(
        {"pact_id": pact["id"], "user_id": user_id, "state": "accepted"},
        on_conflict="pact_id,user_id",
    ).execute()

    # Invite code (reuses the invites machine, kind='pact').
    import secrets, string
    alphabet = string.ascii_lowercase + string.digits
    code = None
    for _ in range(3):
        cand = "".join(secrets.choice(alphabet) for _ in range(8))
        if not sb.table("invites").select("code").eq("code", cand).execute().data:
            code = cand
            break
    if code:
        sb.table("invites").insert(
            {"code": code, "inviter_id": user_id, "kind": "pact", "target_id": pact["id"]}
        ).execute()

    logger.info("Created pact %s for user %s", pact["id"], user_id[:8])
    payload = _pact_payload(sb, pact["id"])
    payload["invite_code"] = code
    return payload


@router.get("")
def list_pacts(user_id: str = Depends(get_current_user_id)):
    """Pacts the caller participates in or created (active + recently resolved)."""
    sb = get_supabase()
    mine = (
        sb.table("pact_participants")
        .select("pact_id")
        .eq("user_id", user_id)
        .execute()
    )
    pact_ids = {r["pact_id"] for r in (mine.data or [])}
    created = sb.table("pacts").select("id").eq("creator_id", user_id).execute()
    for r in (created.data or []):
        pact_ids.add(r["id"])
    if not pact_ids:
        return []
    result = []
    for pid in pact_ids:
        try:
            payload = _maybe_expire(sb, _pact_payload(sb, pid))
            result.append(payload)
        except HTTPException:
            continue
    result.sort(key=lambda p: p.get("created_at") or "", reverse=True)
    return result


@router.get("/{pact_id}")
def get_pact(pact_id: str, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    return _maybe_expire(sb, _pact_payload(sb, pact_id))


def _set_state(pact_id: str, user_id: str, state: str):
    """Transition the caller's OWN state on a pact they're already part of.

    Membership is required: the service-role client bypasses RLS, so without this
    check any authenticated caller who names a pact UUID could self-insert as a
    participant (IDOR) — and via /accept fire an unsolicited push to the creator.
    Legitimate participants are created only by create_pact (the creator) and by
    redeeming a pact invite (social._join_pact), both of which insert the row
    first; this endpoint merely updates an existing row's state.
    """
    sb = get_supabase()
    existing = (
        sb.table("pact_participants")
        .select("state")
        .eq("pact_id", pact_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not (existing and existing.data):
        raise HTTPException(status_code=404, detail="You're not part of this pact")
    sb.table("pact_participants").update({"state": state}).eq("pact_id", pact_id).eq(
        "user_id", user_id
    ).execute()
    return _pact_payload(sb, pact_id)


@router.post("/{pact_id}/accept")
def accept_pact(pact_id: str, background: BackgroundTasks, user_id: str = Depends(get_current_user_id)):
    payload = _set_state(pact_id, user_id, "accepted")
    # Tell the creator someone joined (unless the creator accepted their own).
    creator_id = payload.get("creator_id")
    if creator_id and creator_id != user_id:
        sb = get_supabase()
        who = display_name(sb, user_id)
        background.add_task(
            send_push,
            creator_id,
            f"{who} joined your pact",
            payload.get("title") or "",
            f"/pacts/{pact_id}",
            "pact",
        )
    return payload


@router.post("/{pact_id}/decline")
def decline_pact(pact_id: str, user_id: str = Depends(get_current_user_id)):
    return _set_state(pact_id, user_id, "declined")


@router.post("/{pact_id}/leave")
def leave_pact(pact_id: str, user_id: str = Depends(get_current_user_id)):
    return _set_state(pact_id, user_id, "left")


@router.post("/{pact_id}/done")
def complete_my_part(pact_id: str, background: BackgroundTasks, user_id: str = Depends(get_current_user_id)):
    """Mark the caller's part done via the race-safe RPC. The RPC completes the
    whole pact if this was the last participant."""
    # Use the caller's JWT so auth.uid() inside the SECURITY DEFINER RPC resolves.
    sb = get_supabase()
    try:
        sb.rpc("complete_pact_participation", {"p_pact_id": pact_id, "p_user_id": user_id}).execute()
    except Exception as e:
        logger.warning("complete_pact_participation failed: %s", e)
        raise HTTPException(status_code=400, detail="Could not complete your part")

    payload = _pact_payload(sb, pact_id)
    parts = payload.get("participants") or []
    quorum = [p for p in parts if p.get("state") not in ("declined", "left")]
    done = sum(1 for p in quorum if p.get("state") == "done")
    total = len(quorum)
    title = payload.get("title") or ""
    # Everyone but the actor who is still on the hook (has a device to notify).
    others = [p["user_id"] for p in quorum if p.get("user_id") != user_id]

    if payload.get("status") == "completed":
        for uid in others:
            background.add_task(send_push, uid, "Pact complete 🎉", title, f"/pacts/{pact_id}", "pact")
    else:
        who = display_name(sb, user_id)
        for uid in others:
            background.add_task(
                send_push, uid, f"{who} did their part ({done}/{total})", title, f"/pacts/{pact_id}", "pact"
            )
    return payload


@router.delete("/{pact_id}", status_code=204)
def cancel_pact(pact_id: str, user_id: str = Depends(get_current_user_id)):
    """Creator cancels the pact."""
    sb = get_supabase()
    pact = sb.table("pacts").select("creator_id").eq("id", pact_id).maybe_single().execute()
    if not pact.data:
        raise HTTPException(status_code=404, detail="Pact not found")
    if pact.data["creator_id"] != user_id:
        raise HTTPException(status_code=403, detail="Only the creator can cancel a pact")
    sb.table("pacts").update({"status": "cancelled"}).eq("id", pact_id).execute()
    logger.info("Cancelled pact %s", pact_id)
    return None
