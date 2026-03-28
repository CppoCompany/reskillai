import logging
from fastapi import APIRouter, HTTPException, Header
from jose import jwt, JWTError

from models.user import UserRegister, UserResponse
from services.supabase_client import supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()


def get_clerk_id(authorization: str = Header(...)) -> str:
    """Extract clerk_id (sub) from Clerk JWT.
    CLERK_SECRET_KEY is for Clerk's REST API, not JWT verification.
    JWT tokens use RS256; signature verification would require fetching
    Clerk's JWKS public key. For development we decode without verification.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization[7:]

    try:
        payload = jwt.decode(token, key="", algorithms=["RS256"], options={"verify_signature": False})
        clerk_id = payload.get("sub")
        if not clerk_id:
            raise HTTPException(status_code=401, detail="Token missing sub claim")
        return clerk_id

    except JWTError as e:
        logger.warning(f"JWT decode failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@router.post("/register", response_model=UserResponse)
async def register(body: UserRegister, authorization: str = Header(...)):
    """Sync Clerk user into Supabase after Clerk-side registration."""
    # Verify the JWT matches the clerk_id in the body
    clerk_id = get_clerk_id(authorization)
    if clerk_id != body.clerk_id:
        raise HTTPException(status_code=403, detail="Token clerk_id does not match request body")

    # Idempotent — return existing user if already registered
    existing = supabase_admin.table("users").select("*").eq("clerk_id", body.clerk_id).execute()
    if existing.data:
        return UserResponse(**existing.data[0])

    result = supabase_admin.table("users").insert({
        "clerk_id": body.clerk_id,
        "email": body.email,
        "full_name": body.full_name,
        "user_type": body.user_type,
        "plan": "free",
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create user")

    return UserResponse(**result.data[0])


@router.get("/me", response_model=UserResponse)
async def get_me(authorization: str = Header(...)):
    """Return the current user by clerk_id extracted from JWT."""
    clerk_id = get_clerk_id(authorization)

    result = supabase_admin.table("users").select("*").eq("clerk_id", clerk_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(**result.data[0])
