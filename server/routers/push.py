"""
Push router — Web Push subscription management.

Clients fetch the VAPID public key, subscribe their device, and unsubscribe.
Actual delivery lives in server/push.py (called from other routers via
BackgroundTasks). Subscriptions are keyed by endpoint (unique per device).
"""

import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from db import get_supabase
from auth import get_current_user_id
from push import VAPID_PUBLIC_KEY

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/push", tags=["push"])


class SubKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeBody(BaseModel):
    endpoint: str
    keys: SubKeys
    ua: str | None = None


@router.get("/vapid-key")
def vapid_key(user_id: str = Depends(get_current_user_id)):
    """The VAPID public key the client needs to create a PushSubscription."""
    return {"public_key": VAPID_PUBLIC_KEY}


@router.post("/subscribe", status_code=201)
def subscribe(body: SubscribeBody, user_id: str = Depends(get_current_user_id)):
    """Register (or refresh) this device's push subscription for the caller."""
    sb = get_supabase()
    sb.table("push_subscriptions").upsert(
        {
            "endpoint": body.endpoint,
            "user_id": user_id,
            "p256dh": body.keys.p256dh,
            "auth": body.keys.auth,
            "ua": body.ua,
        },
        on_conflict="endpoint",
    ).execute()
    logger.info("push: subscribed device for %s", user_id[:8])
    return {"ok": True}


class UnsubscribeBody(BaseModel):
    endpoint: str


@router.post("/unsubscribe", status_code=204)
def unsubscribe(body: UnsubscribeBody, user_id: str = Depends(get_current_user_id)):
    """Remove this device's subscription (scoped to the caller)."""
    sb = get_supabase()
    sb.table("push_subscriptions").delete().eq("endpoint", body.endpoint).eq(
        "user_id", user_id
    ).execute()
    return None
