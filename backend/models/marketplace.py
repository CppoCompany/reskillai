from pydantic import BaseModel
from typing import Optional, List, Literal
from uuid import UUID
from datetime import datetime


class ExpertProfileCreate(BaseModel):
    profession: str
    years_experience: int
    industries: List[str]
    skills: List[str]
    languages: List[str]
    bio: Optional[str] = None
    linkedin_url: Optional[str] = None
    hourly_rate: Optional[int] = None
    availability: Literal['full_time', 'part_time', 'project_based']
    location: Optional[str] = None
    timezone: Optional[str] = None


class BusinessProfileCreate(BaseModel):
    company_name: str
    industry: str
    company_size: Literal['1-10', '11-50', '51-200', '200+']
    website: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    needs: List[str]
    budget_range: Literal['under_1k', '1k_5k', '5k_20k', '20k+']


class BusinessProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[Literal['1-10', '11-50', '51-200', '200+']] = None
    website: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    needs: Optional[List[str]] = None
    budget_range: Optional[Literal['under_1k', '1k_5k', '5k_20k', '20k+']] = None


class JobPostCreate(BaseModel):
    title: str
    description: str
    required_profession: str
    required_skills: List[str]
    required_experience: int
    budget_type: Literal['hourly', 'fixed', 'monthly']
    budget_amount: int
    duration: Literal['one_time', 'short_term', 'long_term', 'ongoing']
    location_type: Literal['remote', 'onsite', 'hybrid']


class JobPostResponse(BaseModel):
    id: UUID
    title: str
    description: str
    required_profession: str
    required_skills: List[str]
    required_experience: int
    budget_type: str
    budget_amount: int
    duration: str
    location_type: str
    status: str
    views_count: int
    created_at: datetime
    model_config = {"from_attributes": True}


class ExpertPublicProfile(BaseModel):
    id: UUID
    full_name: Optional[str] = None
    profession: str
    years_experience: int
    skills: List[str]
    industries: List[str]
    hourly_rate: Optional[int] = None
    availability: str
    bio: Optional[str] = None
    ai_risk_score: Optional[int] = None
    model_config = {"from_attributes": True}
