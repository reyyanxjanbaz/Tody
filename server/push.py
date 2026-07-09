"""
Web Push delivery (server-initiated notifications).

`send_push(user_id, ...)` loads that user's push subscriptions, honours their
per-category `notif_prefs`, and delivers a payload to each device via VAPID.
Dead subscriptions (410 Gone / 404) are pruned automatically.

Meant to be called from a FastAPI `BackgroundTasks` so request handlers never
block on the push round-trip. Gracefully no-ops when VAPID keys aren't set, so
the rest of the API keeps working in dev / before push is configured.

Env (set in Render, never committed):
  VAPID_PUBLIC_KEY   — base64url EC P-256 public key (also served to clients)
  VAPID_PRIVATE_KEY  — base64url EC P-256 private key
  VAPID_SUBJECT      — mailto: or https: contact, e.g. "mailto:you@example.com"
"""

import json
import logging
import os

from db import get_service_client

logger = logging.getLogger(__name__)

VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@tody.app")

# Categories a notification can belong to; must match profiles.notif_prefs keys
# and the toggles in the web Settings screen.
CATEGORIES = ("assignment", "pact", "friend", "leaderboard", "reminders")


def push_configured() -> bool:
    return bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)


def display_name(sb, user_id: str, fallback: str = "Someone") -> str:
    """A user's display name for notification copy (best-effort)."""
    try:
        row = (
            sb.table("profiles")
            .select("display_name")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        return (row.data or {}).get("display_name") or fallback
    except Exception:
        return fallback


def _prefs_allow(sb, user_id: str, category: str) -> bool:
    """True unless the user has explicitly disabled this category."""
    try:
        row = (
            sb.table("profiles")
            .select("notif_prefs")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        prefs = (row.data or {}).get("notif_prefs") or {}
        return prefs.get(category, True) is not False
    except Exception:
        return True  # fail open — a pref lookup error shouldn't silence alerts


def send_push(user_id: str, title: str, body: str, url: str = "/", category: str = "reminders") -> None:
    """Deliver a push to all of `user_id`'s devices. Safe to call in the
    background; swallows and logs its own errors."""
    if not push_configured():
        logger.info("Push not configured (no VAPID keys) — skipping %s → %s", category, user_id[:8])
        return
    if category not in CATEGORIES:
        category = "reminders"

    # Imported lazily so the server still boots if pywebpush isn't installed yet.
    from pywebpush import webpush, WebPushException

    sb = get_service_client()
    if not _prefs_allow(sb, user_id, category):
        return

    try:
        subs = (
            sb.table("push_subscriptions")
            .select("endpoint, p256dh, auth")
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as e:
        logger.warning("push: could not load subscriptions for %s: %s", user_id[:8], e)
        return

    payload = json.dumps({"title": title, "body": body, "url": url, "category": category})
    dead: list[str] = []

    for s in subs.data or []:
        info = {
            "endpoint": s["endpoint"],
            "keys": {"p256dh": s["p256dh"], "auth": s["auth"]},
        }
        try:
            webpush(
                subscription_info=info,
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
            )
        except WebPushException as e:
            status = getattr(e.response, "status_code", None)
            if status in (404, 410):  # subscription gone → prune it
                dead.append(s["endpoint"])
            else:
                logger.warning("push: delivery failed (%s): %s", status, e)
        except Exception as e:
            logger.warning("push: unexpected delivery error: %s", e)

    if dead:
        try:
            sb.table("push_subscriptions").delete().in_("endpoint", dead).execute()
            logger.info("push: pruned %d dead subscription(s)", len(dead))
        except Exception:
            pass
