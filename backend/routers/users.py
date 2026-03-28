import logging
from fastapi import APIRouter, HTTPException, Header

from models.user import UserResponse, UserUpdate
from models.marketplace import ExpertProfileCreate, BusinessProfileCreate, BusinessProfileUpdate
from routers.auth import get_clerk_id
from services.supabase_client import supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_user_by_clerk(clerk_id: str) -> dict:
    result = supabase_admin.table("users").select("*").eq("clerk_id", clerk_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return result.data[0]


@router.get("/me")
async def get_me_full(authorization: str = Header(...)):
    """Return user record with nested expert_profile or business_profile."""
    clerk_id = get_clerk_id(authorization)
    user = _get_user_by_clerk(clerk_id)

    if user["user_type"] == "expert":
        profile = supabase_admin.table("expert_profiles").select("*").eq("user_id", user["id"]).execute()
        user["expert_profile"] = profile.data[0] if profile.data else None
    else:
        profile = supabase_admin.table("business_profiles").select("*").eq("user_id", user["id"]).execute()
        user["business_profile"] = profile.data[0] if profile.data else None

    return user


@router.patch("/me", response_model=UserResponse)
async def update_me(body: UserUpdate, authorization: str = Header(...)):
    """Update base user fields (full_name, avatar_url)."""
    clerk_id = get_clerk_id(authorization)
    user = _get_user_by_clerk(clerk_id)

    updates = body.model_dump(exclude_none=True)
    if not updates:
        return UserResponse(**user)

    result = supabase_admin.table("users").update(updates).eq("id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Update failed")

    return UserResponse(**result.data[0])


@router.post("/me/expert-profile")
async def create_expert_profile(body: ExpertProfileCreate, authorization: str = Header(...)):
    """Create expert profile. User must be of type 'expert'. Idempotent."""
    clerk_id = get_clerk_id(authorization)
    user = _get_user_by_clerk(clerk_id)

    if user["user_type"] != "expert":
        raise HTTPException(status_code=403, detail="Only expert users can create an expert profile")

    existing = supabase_admin.table("expert_profiles").select("*").eq("user_id", user["id"]).execute()
    if existing.data:
        return existing.data[0]

    result = supabase_admin.table("expert_profiles").insert({
        "user_id": user["id"],
        **body.model_dump(),
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create expert profile")

    return result.data[0]


@router.get("/me/expert-profile")
async def get_expert_profile(authorization: str = Header(...)):
    """Get own expert profile."""
    clerk_id = get_clerk_id(authorization)
    user = _get_user_by_clerk(clerk_id)

    result = supabase_admin.table("expert_profiles").select("*").eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Expert profile not found")

    return result.data[0]


@router.post("/me/business-profile")
async def create_business_profile(body: BusinessProfileCreate, authorization: str = Header(...)):
    """Create business profile. User must be of type 'business'. Idempotent."""
    clerk_id = get_clerk_id(authorization)
    user = _get_user_by_clerk(clerk_id)

    if user["user_type"] != "business":
        raise HTTPException(status_code=403, detail="Only business users can create a business profile")

    existing = supabase_admin.table("business_profiles").select("*").eq("user_id", user["id"]).execute()
    if existing.data:
        return existing.data[0]

    result = supabase_admin.table("business_profiles").insert({
        "user_id": user["id"],
        **body.model_dump(),
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create business profile")

    return result.data[0]


@router.get("/me/business-profile")
async def get_business_profile(authorization: str = Header(...)):
    """Get own business profile."""
    clerk_id = get_clerk_id(authorization)
    user = _get_user_by_clerk(clerk_id)

    result = supabase_admin.table("business_profiles").select("*").eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Business profile not found")

    return result.data[0]


@router.put("/me/business-profile")
async def update_business_profile(body: BusinessProfileUpdate, authorization: str = Header(...)):
    """Update own business profile (partial — only provided fields are changed)."""
    clerk_id = get_clerk_id(authorization)
    user = _get_user_by_clerk(clerk_id)

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        supabase_admin.table("business_profiles")
        .update(updates)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Business profile not found")

    return result.data[0]
