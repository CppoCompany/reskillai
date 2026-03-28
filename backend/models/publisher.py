from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime


class PositionDraft(BaseModel):
    """Used for AI review before saving."""
    title: str
    description: str
    required_skills: List[str] = []
    required_experience: int = 0
    education_level: str = 'bachelor'
    location: Optional[str] = None
    work_type: Literal['remote', 'onsite', 'hybrid'] = 'remote'
    employment_type: Literal['full_time', 'part_time', 'contract', 'freelance'] = 'full_time'
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None


class PositionCreate(PositionDraft):
    """Same fields as draft — used to save the position after AI review."""
    pass


class PositionReviewOutput(BaseModel):
    approved: bool
    issues: List[str] = []
    suggestions: List[str] = []


class PositionResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: str
    required_skills: List[str]
    required_experience: int
    education_level: str
    location: Optional[str]
    work_type: str
    employment_type: str
    salary_min: Optional[int]
    salary_max: Optional[int]
    status: str
    ai_review: Optional[dict]
    match_count: int = 0
    created_at: str
    updated_at: str


class PositionMatch(BaseModel):
    """Anonymous expert match — no name or contact info."""
    id: str
    match_score: int
    match_explanation: str
    matched_skills: List[str]
    # anonymised expert details
    years_experience: int
    current_industry: str
    education_level: str
    risk_level: str


class UpdateStatusInput(BaseModel):
    status: Literal['open', 'closed']


class MatchFeedbackInput(BaseModel):
    is_relevant: Optional[bool] = None   # True = relevant, False = not relevant, None = unreviewed
    comment: Optional[str] = None
