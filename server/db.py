"""
Supabase client helpers.

- get_service_client(): admin/service-role client (bypasses RLS).
  Used only for auth verification and admin-only operations.
- get_supabase():  convenience alias — returns the service client.
  All routers MUST filter by user_id on every query.

Security note: The service-role key bypasses RLS.  Every router must
scope queries with `.eq("user_id", uid)` to enforce data isolation.
"""

import os, logging
from functools import lru_cache
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    logger.warning(
        "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — "
        "the server will fail on the first request."
    )


@lru_cache()
def get_service_client() -> Client:
    """Admin client — use sparingly (bypasses RLS)."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "Supabase credentials not configured. "
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_supabase() -> Client:
    """Returns the service-role client.  RLS is NOT enforced — routers
    must always filter by user_id."""
    return get_service_client()
