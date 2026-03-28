from pydantic import BaseModel
from typing import Optional, List, Literal, Any


class AssessmentInput(BaseModel):
    job_title: str
    current_industry: str
    years_experience: int
    current_skills: List[str]
    education_level: Literal['high_school', 'bachelor', 'master', 'phd', 'other']
    annual_salary: Optional[int] = None
    location: Optional[str] = None
    cv_text: Optional[str] = None


class AssessmentOutput(BaseModel):
    ai_displacement_risk: int
    risk_level: Literal['low', 'medium', 'high', 'critical']
    risk_explanation: str
    affected_tasks: List[str]
    safe_tasks: List[str]
    recommended_path: Literal['pivot', 'upskill', 'specialize', 'entrepreneurship']
    path_explanation: str
    recommended_roles: List[str]
    skills_to_learn: List[str]
    timeline_months: int
    salary_potential: Optional[int] = None


class RoleDetailInput(BaseModel):
    role: str
    job_title: str
    current_industry: str
    years_experience: int
    current_skills: List[str]
    education_level: str
    cv_text: Optional[str] = None


class LearningStep(BaseModel):
    step: int
    title: str
    description: str
    duration_months: int
    resources: List[str]


class RoleDetailOutput(BaseModel):
    role: str
    overview: str
    skills_you_have: List[str]
    skills_to_acquire: List[str]
    learning_path: List[Any]
    timeline_months: int
    difficulty: Literal['easy', 'medium', 'hard']
    salary_range: str


class CvImproveInput(BaseModel):
    cv_text: str
    target_role: Optional[str] = None


class CvImproveOutput(BaseModel):
    improved_cv: str
    improvements: List[str]


class SkillTrainingInput(BaseModel):
    skill: str
    job_title: str
    current_industry: str
    years_experience: int
    current_skills: List[str]
    education_level: str
    cv_text: Optional[str] = None


class TrainingStep(BaseModel):
    step: int
    title: str
    description: str
    tasks: List[str]
    estimated_hours: int


class SkillTrainingOutput(BaseModel):
    skill: str
    project_title: str
    project_description: str
    difficulty: Literal['beginner', 'intermediate', 'advanced']
    why_this_project: str
    tech_stack: List[str]
    steps: List[Any]
    outcome: str
    resources: List[str]
    ai_skills: List[Any] = []


class SaveTrainingInput(BaseModel):
    skill: str
    training_data: dict


class UpdateProgressInput(BaseModel):
    skill: str
    completed_steps: List[int]
