import logging
from fastapi import APIRouter, HTTPException, Header, Query
from uuid import UUID
from typing import Optional

from models.marketplace import JobPostCreate, JobPostResponse, ExpertPublicProfile
from routers.auth import get_clerk_id
from services.supabase_client import supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_user(clerk_id: str) -> dict:
    result = supabase_admin.table("users").select("id, user_type").eq("clerk_id", clerk_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return result.data[0]


# ── Experts ──────────────────────────────────────────────────────────

@router.get("/experts")
async def list_experts(
    skills: Optional[str] = Query(None, description="Comma-separated skills filter"),
    profession: Optional[str] = Query(None),
):
    query = (
        supabase_admin.table("expert_profiles")
        .select("id, profession, years_experience, skills, industries, hourly_rate, availability, bio, ai_risk_score, users(full_name)")
        .eq("is_visible", True)
    )
    if profession:
        query = query.ilike("profession", f"%{profession}%")

    result = query.execute()
    experts = []
    for row in result.data:
        user_data = row.get("users") or {}
        expert = {
            "id": row["id"],
            "full_name": user_data.get("full_name") if isinstance(user_data, dict) else None,
            "profession": row["profession"],
            "years_experience": row["years_experience"],
            "skills": row.get("skills") or [],
            "industries": row.get("industries") or [],
            "hourly_rate": row.get("hourly_rate"),
            "availability": row["availability"],
            "bio": row.get("bio"),
            "ai_risk_score": row.get("ai_risk_score"),
        }
        if skills:
            filter_skills = [s.strip().lower() for s in skills.split(",")]
            expert_skills = [s.lower() for s in expert["skills"]]
            if not any(fs in " ".join(expert_skills) for fs in filter_skills):
                continue
        experts.append(expert)

    return experts


@router.get("/experts/{expert_id}")
async def get_expert(expert_id: UUID):
    result = (
        supabase_admin.table("expert_profiles")
        .select("id, profession, years_experience, skills, industries, hourly_rate, availability, bio, ai_risk_score, users(full_name)")
        .eq("id", str(expert_id))
        .eq("is_visible", True)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Expert not found")

    row = result.data[0]
    user_data = row.get("users") or {}
    return {
        "id": row["id"],
        "full_name": user_data.get("full_name") if isinstance(user_data, dict) else None,
        "profession": row["profession"],
        "years_experience": row["years_experience"],
        "skills": row.get("skills") or [],
        "industries": row.get("industries") or [],
        "hourly_rate": row.get("hourly_rate"),
        "availability": row["availability"],
        "bio": row.get("bio"),
        "ai_risk_score": row.get("ai_risk_score"),
    }


# ── Jobs ──────────────────────────────────────────────────────────────

@router.get("/jobs")
async def list_jobs(
    skills: Optional[str] = Query(None, description="Comma-separated skills filter"),
    profession: Optional[str] = Query(None),
):
    query = (
        supabase_admin.table("job_posts")
        .select("*")
        .eq("status", "open")
        .order("created_at", desc=True)
    )
    if profession:
        query = query.ilike("required_profession", f"%{profession}%")

    result = query.execute()
    jobs = result.data or []

    if skills:
        filter_skills = [s.strip().lower() for s in skills.split(",")]
        filtered = []
        for job in jobs:
            job_skills = [s.lower() for s in (job.get("required_skills") or [])]
            if any(fs in " ".join(job_skills) for fs in filter_skills):
                filtered.append(job)
        jobs = filtered

    return jobs


@router.post("/jobs")
async def create_job(body: JobPostCreate, authorization: str = Header(...)):
    clerk_id = get_clerk_id(authorization)
    user = _get_user(clerk_id)

    if user["user_type"] != "business":
        raise HTTPException(status_code=403, detail="Only business users can post jobs")

    # Get business profile
    biz = supabase_admin.table("business_profiles").select("id").eq("user_id", user["id"]).execute()
    if not biz.data:
        raise HTTPException(status_code=400, detail="Complete your business profile before posting jobs")

    row = {
        "business_id": biz.data[0]["id"],
        "title": body.title,
        "description": body.description,
        "required_profession": body.required_profession,
        "required_skills": body.required_skills,
        "required_experience": body.required_experience,
        "budget_type": body.budget_type,
        "budget_amount": body.budget_amount,
        "duration": body.duration,
        "location_type": body.location_type,
        "status": "open",
        "views_count": 0,
    }

    result = supabase_admin.table("job_posts").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create job post")

    return result.data[0]


@router.get("/jobs/{job_id}")
async def get_job(job_id: UUID):
    result = (
        supabase_admin.table("job_posts")
        .select("*")
        .eq("id", str(job_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job = result.data[0]

    # Increment views_count
    try:
        supabase_admin.table("job_posts").update(
            {"views_count": (job.get("views_count") or 0) + 1}
        ).eq("id", str(job_id)).execute()
    except Exception:
        pass

    return job
