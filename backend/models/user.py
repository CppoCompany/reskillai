from pydantic import BaseModel, EmailStr
from typing import Optional, Literal
from uuid import UUID
from datetime import datetime


class UserRegister(BaseModel):
    clerk_id: str
    email: EmailStr
    full_name: str
    user_type: Literal['expert', 'business']


class UserResponse(BaseModel):
    id: UUID
    clerk_id: str
    email: str
    full_name: Optional[str] = None
    user_type: str
    plan: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
