"""
Auth helper — extracts and validates the Supabase JWT from the Authorization header.
Returns the user's UUID so routers can scope queries.

The token is validated by calling Supabase's `auth.get_user(token)` which
verifies the JWT signature *and* checks it hasn't been revoked.
"""

import logging
from fastapi import Header, HTTPException
from db import get_service_client

logger = logging.getLogger(__name__)


async def get_current_user_id(authorization: str = Header(...)) -> str:
    """
    Expects: Authorization: Bearer <supabase-jwt>
    Returns the user's UUID (str).
    Raises 401 on any failure.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty token")

    try:
        client = get_service_client()
        user_response = client.auth.get_user(token)
        user = user_response.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token — no user")
        return user.id
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Auth failed: %s", e)
        raise HTTPException(status_code=401, detail="Authentication failed")
