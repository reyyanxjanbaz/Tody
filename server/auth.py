"""
Auth helper — extracts and validates the Supabase JWT from the Authorization header.
Returns the user's UUID so routers can scope queries.
"""

from fastapi import Header, HTTPException
from db import get_service_client


async def get_current_user_id(authorization: str = Header(...)) -> str:
    """
    Expects: Authorization: Bearer <supabase-jwt>
    Returns the user's UUID.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization.split(" ", 1)[1]

    try:
        client = get_service_client()
        user_response = client.auth.get_user(token)
        user = user_response.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user.id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth failed: {str(e)}")
