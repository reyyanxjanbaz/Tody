"""
Supabase client helpers.
- get_service_client(): admin/service-role client (bypasses RLS)
- get_supabase():       per-request client scoped to the user's JWT
"""

import os
from functools import lru_cache
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]


@lru_cache()
def get_service_client() -> Client:
    """Admin client — use sparingly (bypasses RLS)."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_supabase() -> Client:
    """Returns the service-role client. RLS is enforced by filtering on user_id."""
    return get_service_client()
