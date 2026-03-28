import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Header
from uuid import UUID

from models.publisher import PositionDraft, PositionCreate, PositionReviewOutput, UpdateStatusInput, MatchFeedbackInput
from routers.auth import get_clerk_id
from services.supabase_client import supabase_admin
from services.ai_service import review_position, match_experts

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_business_user(clerk_id: str) -> dict:
    result = supabase_admin.table("users").select("id, user_type").eq("clerk_id", clerk_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    user = result.data[0]
    if user["user_type"] != "business":
        raise HTTPException(status_code=403, detail="Only business users can access the publisher portal")
    return user


def _run_matching(position_id: str, position: dict) -> None:
    """Fetch expert candidates, score them with AI, save top 10 to position_matches."""
    try:
        # Fetch all users who have completed at least one assessment
        assessments = (
            supabase_admin.table("career_assessments")
            .select("user_id, job_title, current_industry, years_experience, current_skills, education_level, risk_level")
            .order("created_at", desc=True)
            .execute()
        )
        if not assessments.data:
            return

        # Deduplicate — one record per user (most recent assessment)
        seen = set()
        candidates = []
        for row in assessments.data:
            uid = row["user_id"]
            if uid in seen:
                continue
            seen.add(uid)
            candidates.append(row)

        # Pre-filter: experience within 3 years of required, at least 1 skill overlap (substring)
        req_exp = position.get("required_experience", 0)
        req_skills_lower = [s.lower() for s in position.get("required_skills", [])]

        def _skills_overlap(cand_skills: list) -> bool:
            if not req_skills_lower:
                return True
            cand_lower = [s.lower() for s in (cand_skills or [])]
            for r in req_skills_lower:
                for c in cand_lower:
                    if r in c or c in r:
                        return True
            return False

        filtered = []
        for c in candidates:
            exp_ok = c.get("years_experience", 0) >= max(0, req_exp - 3)
            if exp_ok and _skills_overlap(c.get("current_skills") or []):
                filtered.append(c)

        # Cap at 20 candidates for the AI call
        top_candidates = filtered[:20]
        if not top_candidates:
            top_candidates = candidates[:20]  # fallback: send all candidates when no overlap found

        # Batch-fetch CVs and attach to candidates
        top_user_ids = [c["user_id"] for c in top_candidates]
        cv_rows = supabase_admin.table("user_cvs").select("user_id, cv_text").in_("user_id", top_user_ids).execute()
        cv_map = {row["user_id"]: row["cv_text"] for row in (cv_rows.data or [])}
        for c in top_candidates:
            c["cv_text"] = cv_map.get(c["user_id"], "")

        matches = match_experts(position, top_candidates)

        # Sort by score descending, take top 10
        matches.sort(key=lambda m: m.get("match_score", 0), reverse=True)
        top_matches = matches[:10]

        now = datetime.now(timezone.utc).isoformat()
        rows = []
        for m in top_matches:
            expert_uid = m.get("expert_user_id")
            if not expert_uid:
                continue
            rows.append({
                "position_id": position_id,
                "expert_user_id": expert_uid,
                "match_score": m.get("match_score", 0),
                "match_explanation": m.get("explanation", ""),
                "matched_skills": m.get("matched_skills", []),
                "created_at": now,
            })

        if rows:
            supabase_admin.table("position_matches").upsert(
                rows, on_conflict="position_id,expert_user_id"
            ).execute()

    except Exception as e:
        logger.error(f"Matching failed for position {position_id}: {type(e).__name__}: {e}")


# ── Endpoints ─────────────────────────────────────────────────────────


@router.post("/review", response_model=PositionReviewOutput)
async def review_position_draft(body: PositionDraft, authorization: str = Header(...)):
    """AI-review a position draft before publishing. Returns issues and suggestions."""
    get_clerk_id(authorization)  # auth only — any signed-in user can preview
    try:
        result = review_position(body.model_dump())
    except Exception as e:
        logger.error(f"Position review AI failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"AI review error: {type(e).__name__}: {e}")
    return PositionReviewOutput(**result)


@router.post("/positions")
async def create_position(body: PositionCreate, authorization: str = Header(...)):
    """Create a new position and immediately run expert matching."""
    clerk_id = get_clerk_id(authorization)
    user = _get_business_user(clerk_id)
    now = datetime.now(timezone.utc).isoformat()

    row = {
        "user_id": user["id"],
        "title": body.title,
        "description": body.description,
        "required_skills": body.required_skills,
        "required_experience": body.required_experience,
        "education_level": body.education_level,
        "location": body.location,
        "work_type": body.work_type,
        "employment_type": body.employment_type,
        "salary_min": body.salary_min,
        "salary_max": body.salary_max,
        "status": "open",
        "created_at": now,
        "updated_at": now,
    }

    result = supabase_admin.table("positions").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create position")

    position = result.data[0]
    position_id = position["id"]

    # Run matching synchronously — results available immediately
    _run_matching(position_id, body.model_dump())

    # Fetch the matches to return with the position
    matches_result = supabase_admin.table("position_matches").select("*").eq("position_id", position_id).order("match_score", desc=True).execute()

    return {**position, "matches": matches_result.data or []}


@router.get("/positions")
async def list_positions(authorization: str = Header(...)):
    """List all positions for the current business user with match counts."""
    clerk_id = get_clerk_id(authorization)
    user = _get_business_user(clerk_id)

    positions = (
        supabase_admin.table("positions")
        .select("*")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )

    result = []
    for pos in (positions.data or []):
        # Count matches
        count_result = supabase_admin.table("position_matches").select("id", count="exact").eq("position_id", pos["id"]).execute()
        pos["match_count"] = count_result.count or 0
        result.append(pos)

    return result


@router.get("/positions/{position_id}")
async def get_position(position_id: UUID, authorization: str = Header(...)):
    """Get a single position (must belong to the current user)."""
    clerk_id = get_clerk_id(authorization)
    user = _get_business_user(clerk_id)

    result = (
        supabase_admin.table("positions")
        .select("*")
        .eq("id", str(position_id))
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Position not found")

    pos = result.data[0]
    count_result = supabase_admin.table("position_matches").select("id", count="exact").eq("position_id", str(position_id)).execute()
    pos["match_count"] = count_result.count or 0
    return pos


@router.get("/positions/{position_id}/matches")
async def get_position_matches(position_id: UUID, authorization: str = Header(...)):
    """Get anonymised expert matches for a position."""
    clerk_id = get_clerk_id(authorization)
    user = _get_business_user(clerk_id)

    # Verify ownership
    pos = supabase_admin.table("positions").select("id").eq("id", str(position_id)).eq("user_id", user["id"]).execute()
    if not pos.data:
        raise HTTPException(status_code=404, detail="Position not found")

    matches = (
        supabase_admin.table("position_matches")
        .select("*")
        .eq("position_id", str(position_id))
        .order("match_score", desc=True)
        .execute()
    )

    match_rows = matches.data or []

    # Batch-fetch all expert assessments in one query (most recent per user)
    expert_ids = [m["expert_user_id"] for m in match_rows]
    assessment_map: dict = {}
    if expert_ids:
        a_rows = (
            supabase_admin.table("career_assessments")
            .select("user_id, years_experience, current_industry, education_level, risk_level, ai_displacement_risk")
            .in_("user_id", expert_ids)
            .order("created_at", desc=True)
            .execute()
        )
        for row in (a_rows.data or []):
            uid = row["user_id"]
            if uid not in assessment_map:   # keep most recent
                assessment_map[uid] = row

    def _derive_risk_level(details: dict) -> str:
        """Return risk_level string; fall back to deriving it from ai_displacement_risk int."""
        rl = details.get("risk_level") or ""
        if rl:
            return rl
        score = details.get("ai_displacement_risk")
        if score is None:
            return ""
        if score <= 33:
            return "low"
        if score <= 66:
            return "medium"
        if score <= 84:
            return "high"
        return "critical"

    enriched = []
    for m in match_rows:
        details = assessment_map.get(m["expert_user_id"], {})
        enriched.append({
            "id": m["id"],
            "match_score": m["match_score"],
            "match_explanation": m["match_explanation"],
            "matched_skills": m["matched_skills"] or [],
            "is_relevant": m.get("is_relevant"),
            "comment": m.get("comment"),
            "years_experience": details.get("years_experience", 0),
            "current_industry": details.get("current_industry", ""),
            "education_level": details.get("education_level", ""),
            "risk_level": _derive_risk_level(details),
        })

    return enriched


@router.put("/positions/{position_id}")
async def update_position(position_id: UUID, body: PositionCreate, authorization: str = Header(...)):
    """Update a position's details and re-run expert matching."""
    clerk_id = get_clerk_id(authorization)
    user = _get_business_user(clerk_id)
    now = datetime.now(timezone.utc).isoformat()

    updates = {
        "title": body.title,
        "description": body.description,
        "required_skills": body.required_skills,
        "required_experience": body.required_experience,
        "education_level": body.education_level,
        "location": body.location,
        "work_type": body.work_type,
        "employment_type": body.employment_type,
        "salary_min": body.salary_min,
        "salary_max": body.salary_max,
        "updated_at": now,
    }

    result = (
        supabase_admin.table("positions")
        .update(updates)
        .eq("id", str(position_id))
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Position not found")

    position = result.data[0]

    # Save existing feedback before clearing, then restore after re-matching
    old_matches = supabase_admin.table("position_matches").select("expert_user_id, is_relevant, comment").eq("position_id", str(position_id)).execute()
    feedback_map = {r["expert_user_id"]: r for r in (old_matches.data or []) if r.get("is_relevant") is not None or r.get("comment")}

    supabase_admin.table("position_matches").delete().eq("position_id", str(position_id)).execute()
    _run_matching(str(position_id), body.model_dump())

    # Restore feedback for any experts still in the new match set
    if feedback_map:
        new_matches = supabase_admin.table("position_matches").select("id, expert_user_id").eq("position_id", str(position_id)).execute()
        for nm in (new_matches.data or []):
            fb = feedback_map.get(nm["expert_user_id"])
            if fb:
                supabase_admin.table("position_matches").update({
                    "is_relevant": fb.get("is_relevant"),
                    "comment": fb.get("comment"),
                }).eq("id", nm["id"]).execute()

    matches_result = (
        supabase_admin.table("position_matches")
        .select("*")
        .eq("position_id", str(position_id))
        .order("match_score", desc=True)
        .execute()
    )

    return {**position, "matches": matches_result.data or []}


@router.post("/positions/{position_id}/rematch")
async def rematch_position(position_id: UUID, authorization: str = Header(...)):
    """Re-run expert matching for an existing position without changing its details."""
    clerk_id = get_clerk_id(authorization)
    user = _get_business_user(clerk_id)

    result = (
        supabase_admin.table("positions")
        .select("*")
        .eq("id", str(position_id))
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Position not found")

    position = result.data[0]

    # Re-run matching — upsert preserves is_relevant/comment on existing rows
    _run_matching(str(position_id), position)

    matches_result = (
        supabase_admin.table("position_matches")
        .select("*")
        .eq("position_id", str(position_id))
        .order("match_score", desc=True)
        .execute()
    )
    return {"matches": matches_result.data or []}


@router.patch("/positions/{position_id}/status")
async def update_position_status(position_id: UUID, body: UpdateStatusInput, authorization: str = Header(...)):
    """Open or close a position."""
    clerk_id = get_clerk_id(authorization)
    user = _get_business_user(clerk_id)

    now = datetime.now(timezone.utc).isoformat()
    result = (
        supabase_admin.table("positions")
        .update({"status": body.status, "updated_at": now})
        .eq("id", str(position_id))
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Position not found")
    return result.data[0]


@router.patch("/positions/{position_id}/matches/{match_id}/feedback")
async def update_match_feedback(
    position_id: UUID,
    match_id: UUID,
    body: MatchFeedbackInput,
    authorization: str = Header(...)
):
    """Save relevance flag and/or comment on a specific match."""
    clerk_id = get_clerk_id(authorization)
    user = _get_business_user(clerk_id)

    # Verify the position belongs to this user
    pos = supabase_admin.table("positions").select("id").eq("id", str(position_id)).eq("user_id", user["id"]).execute()
    if not pos.data:
        raise HTTPException(status_code=404, detail="Position not found")

    updates = {}
    if body.is_relevant is not None:
        updates["is_relevant"] = body.is_relevant
    if body.comment is not None:
        updates["comment"] = body.comment

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        supabase_admin.table("position_matches")
        .update(updates)
        .eq("id", str(match_id))
        .eq("position_id", str(position_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Match not found")
    return result.data[0]


@router.get("/profile")
async def get_publisher_profile(authorization: str = Header(...)):
    """Get business user profile + business profile combined."""
    clerk_id = get_clerk_id(authorization)
    user = _get_business_user(clerk_id)

    user_row = supabase_admin.table("users").select("id, email, full_name, plan, created_at").eq("id", user["id"]).execute()
    biz_row = supabase_admin.table("business_profiles").select("*").eq("user_id", user["id"]).execute()

    return {
        "user": user_row.data[0] if user_row.data else {},
        "business": biz_row.data[0] if biz_row.data else None,
    }
