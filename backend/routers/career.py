import io
import logging
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, HTTPException, Header, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from uuid import UUID

from models.career import AssessmentInput, AssessmentOutput, RoleDetailInput, RoleDetailOutput, CvImproveInput, CvImproveOutput, SkillTrainingInput, SkillTrainingOutput, SaveTrainingInput, UpdateProgressInput
from routers.auth import get_clerk_id
from services.supabase_client import supabase_admin
from services.ai_service import run_career_assessment, run_role_detail, run_cv_improve, run_skill_training, generate_step_lesson, answer_step_question

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_user_id(clerk_id: str) -> str:
    result = supabase_admin.table("users").select("id").eq("clerk_id", clerk_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return result.data[0]["id"]


class UserCvUpsert(BaseModel):
    cv_text: str
    cv_filename: str


@router.get("/user-cv")
async def get_user_cv(authorization: str = Header(...)):
    clerk_id = get_clerk_id(authorization)
    user_id = _get_user_id(clerk_id)
    result = supabase_admin.table("user_cvs").select("*").eq("user_id", user_id).execute()
    return result.data[0] if result.data else None


@router.put("/user-cv")
async def upsert_user_cv(body: UserCvUpsert, authorization: str = Header(...)):
    clerk_id = get_clerk_id(authorization)
    user_id = _get_user_id(clerk_id)
    result = (
        supabase_admin.table("user_cvs")
        .upsert({"user_id": user_id, "cv_text": body.cv_text, "cv_filename": body.cv_filename}, on_conflict="user_id")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save CV")
    return result.data[0]


@router.delete("/user-cv")
async def delete_user_cv(authorization: str = Header(...)):
    clerk_id = get_clerk_id(authorization)
    user_id = _get_user_id(clerk_id)
    supabase_admin.table("user_cvs").delete().eq("user_id", user_id).execute()
    return {"ok": True}


@router.post("/cv-extract")
async def extract_cv(file: UploadFile = File(...), authorization: str = Header(...)):
    get_clerk_id(authorization)  # auth check only

    content_type = file.content_type or ""
    filename = file.filename or ""

    raw = await file.read()

    DOCX_TYPES = {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/docx",
    }

    if content_type == "application/pdf" or filename.lower().endswith(".pdf"):
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(raw))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Could not parse PDF: {e}")
    elif content_type in DOCX_TYPES or filename.lower().endswith(".docx"):
        try:
            from docx import Document
            doc = Document(io.BytesIO(raw))
            text = "\n".join(p.text for p in doc.paragraphs)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Could not parse DOCX: {e}")
    elif content_type.startswith("text/") or filename.lower().endswith(".txt"):
        text = raw.decode("utf-8", errors="ignore")
    else:
        raise HTTPException(status_code=415, detail="Unsupported file type. Please upload a PDF, DOCX, or TXT file.")

    text = text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Could not extract any text from the file.")

    return {"cv_text": text}


class CvExportInput(BaseModel):
    cv_text: str
    template: Literal["classic", "modern", "minimal"] = "modern"
    format: Literal["docx", "pdf"] = "docx"


@router.post("/cv-export")
async def export_cv(body: CvExportInput, authorization: str = Header(...)):
    get_clerk_id(authorization)  # auth check only
    try:
        from services.cv_export import generate_docx, generate_pdf
        if body.format == "docx":
            file_bytes = generate_docx(body.cv_text, body.template)
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            filename = f"cv-{body.template}.docx"
        else:
            file_bytes = generate_pdf(body.cv_text, body.template)
            media_type = "application/pdf"
            filename = f"cv-{body.template}.pdf"
    except Exception as e:
        logger.error(f"CV export failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"CV export failed: {e}")

    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/cv-improve", response_model=CvImproveOutput)
async def improve_cv(body: CvImproveInput, authorization: str = Header(...)):
    get_clerk_id(authorization)  # auth check only
    try:
        result = run_cv_improve(body)
    except Exception as e:
        logger.error(f"CV improve AI failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"CV improve error: {type(e).__name__}: {e}")
    return CvImproveOutput(**result)


@router.post("/skill-training", response_model=SkillTrainingOutput)
async def get_skill_training(body: SkillTrainingInput, authorization: str = Header(...)):
    get_clerk_id(authorization)  # auth check only
    try:
        result = run_skill_training(body)
    except Exception as e:
        logger.error(f"Skill training AI failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"Skill training error: {type(e).__name__}: {e}")
    return SkillTrainingOutput(**result)


@router.put("/skill-training/session")
async def save_training_session(body: SaveTrainingInput, authorization: str = Header(...)):
    """Upsert a training session. Creates a new record or updates training_data only (preserving progress)."""
    clerk_id = get_clerk_id(authorization)
    user_id = _get_user_id(clerk_id)
    now = datetime.now(timezone.utc).isoformat()

    existing = (
        supabase_admin.table("skill_trainings")
        .select("id")
        .eq("user_id", user_id)
        .eq("skill", body.skill)
        .execute()
    )

    if existing.data:
        result = (
            supabase_admin.table("skill_trainings")
            .update({"training_data": body.training_data, "updated_at": now})
            .eq("user_id", user_id)
            .eq("skill", body.skill)
            .execute()
        )
    else:
        result = (
            supabase_admin.table("skill_trainings")
            .insert({"user_id": user_id, "skill": body.skill, "training_data": body.training_data, "completed_steps": []})
            .execute()
        )

    return result.data[0] if result.data else {"ok": True}


@router.get("/skill-training/session")
async def get_training_session(skill: str = Query(...), authorization: str = Header(...)):
    """Return a single saved training session including full training_data and progress."""
    clerk_id = get_clerk_id(authorization)
    user_id = _get_user_id(clerk_id)
    result = (
        supabase_admin.table("skill_trainings")
        .select("*")
        .eq("user_id", user_id)
        .eq("skill", skill)
        .execute()
    )
    return result.data[0] if result.data else None


@router.get("/skill-training/sessions")
async def list_training_sessions(authorization: str = Header(...)):
    """Return summary of all saved training sessions for the user (no training_data payload)."""
    clerk_id = get_clerk_id(authorization)
    user_id = _get_user_id(clerk_id)
    result = (
        supabase_admin.table("skill_trainings")
        .select("id, skill, completed_steps, created_at, updated_at")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )
    return result.data


class StepLessonInput(BaseModel):
    skill: str
    step_number: int
    step_title: str
    step_description: str
    step_tasks: list = []


@router.post("/skill-training/step-lesson")
async def get_step_lesson(body: StepLessonInput, authorization: str = Header(...)):
    """Generate an interactive lesson + quiz for a single training step."""
    clerk_id = get_clerk_id(authorization)
    _get_user_id(clerk_id)
    step = {
        "title": body.step_title,
        "description": body.step_description,
        "tasks": body.step_tasks,
    }
    try:
        result = generate_step_lesson(step, body.skill)
    except Exception as e:
        logger.error(f"Step lesson AI failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"Lesson generation failed: {type(e).__name__}: {e}")
    return result


class AskQuestionInput(BaseModel):
    skill: str
    step_title: str
    step_description: str
    question: str
    lesson_context: str = ""


@router.post("/skill-training/ask")
async def ask_step_question(body: AskQuestionInput, authorization: str = Header(...)):
    """Answer a student's question about a specific training step."""
    clerk_id = get_clerk_id(authorization)
    _get_user_id(clerk_id)
    try:
        answer = answer_step_question(
            body.skill, body.step_title, body.step_description,
            body.question, body.lesson_context,
        )
    except Exception as e:
        logger.error(f"ask_step_question AI failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"Question answering failed: {type(e).__name__}: {e}")
    return {"answer": answer}


@router.patch("/skill-training/session/progress")
async def update_training_progress(body: UpdateProgressInput, authorization: str = Header(...)):
    """Update completed_steps for a training session."""
    clerk_id = get_clerk_id(authorization)
    user_id = _get_user_id(clerk_id)
    now = datetime.now(timezone.utc).isoformat()
    try:
        result = (
            supabase_admin.table("skill_trainings")
            .update({"completed_steps": body.completed_steps, "updated_at": now})
            .eq("user_id", user_id)
            .eq("skill", body.skill)
            .execute()
        )
    except Exception as e:
        logger.error(f"update_training_progress failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"DB error: {type(e).__name__}: {e}")
    return result.data[0] if result.data else {"ok": True}


@router.post("/role-detail", response_model=RoleDetailOutput)
async def get_role_detail(body: RoleDetailInput, authorization: str = Header(...)):
    get_clerk_id(authorization)  # auth check only
    try:
        result = run_role_detail(body)
    except Exception as e:
        logger.error(f"Role detail AI failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"Role detail error: {type(e).__name__}: {e}")
    return RoleDetailOutput(**result)


@router.post("/assessment", response_model=AssessmentOutput)
async def create_assessment(body: AssessmentInput, authorization: str = Header(...)):
    clerk_id = get_clerk_id(authorization)
    user_id = _get_user_id(clerk_id)

    # Auto-attach stored CV if the request didn't include one
    if not body.cv_text:
        cv_row = supabase_admin.table("user_cvs").select("cv_text").eq("user_id", user_id).execute()
        if cv_row.data:
            body = body.model_copy(update={"cv_text": cv_row.data[0]["cv_text"]})

    try:
        result = run_career_assessment(body)
    except Exception as e:
        logger.error(f"AI assessment failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"AI assessment error: {type(e).__name__}: {e}")

    row = {
        "user_id": user_id,
        "job_title": body.job_title,
        "current_industry": body.current_industry,
        "years_experience": body.years_experience,
        "current_skills": body.current_skills,
        "education_level": body.education_level,
        "annual_salary": body.annual_salary,
        "location": body.location,
        "ai_displacement_risk": result["ai_displacement_risk"],
        "risk_level": result["risk_level"],
        "risk_explanation": result["risk_explanation"],
        "affected_tasks": result["affected_tasks"],
        "safe_tasks": result["safe_tasks"],
        "recommended_path": result["recommended_path"],
        "path_explanation": result["path_explanation"],
        "recommended_roles": result["recommended_roles"],
        "skills_to_learn": result["skills_to_learn"],
        "timeline_months": result["timeline_months"],
        "salary_potential": result.get("salary_potential"),
    }

    try:
        saved = supabase_admin.table("career_assessments").insert(row).execute()
        if not saved.data:
            logger.warning("Assessment not saved to DB (empty response) — returning result anyway")
    except Exception as db_err:
        logger.error(f"DB save failed: {type(db_err).__name__}: {db_err} — returning result anyway")

    return AssessmentOutput(**result)


@router.get("/assessments")
async def list_assessments(authorization: str = Header(...)):
    clerk_id = get_clerk_id(authorization)
    user_id = _get_user_id(clerk_id)

    result = (
        supabase_admin.table("career_assessments")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.get("/assessment/{assessment_id}")
async def get_assessment(assessment_id: UUID, authorization: str = Header(...)):
    clerk_id = get_clerk_id(authorization)
    user_id = _get_user_id(clerk_id)

    result = (
        supabase_admin.table("career_assessments")
        .select("*")
        .eq("id", str(assessment_id))
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Assessment not found")

    return result.data[0]
