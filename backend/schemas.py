"""
SmartSoma Pydantic Schemas
Request/response validation for all API endpoints.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, field_validator


# ─── Auth ────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str = "student"          # "student" | "teacher"
    grade_level: Optional[str] = None  # S1, S2, S3

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v: str) -> str:
        if v not in ("student", "teacher"):
            raise ValueError("role must be 'student' or 'teacher'")
        return v

    @field_validator("grade_level")
    @classmethod
    def grade_must_be_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("S1", "S2", "S3"):
            raise ValueError("grade_level must be S1, S2, or S3")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    full_name: str


# ─── Users ───────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    user_id: int
    full_name: str
    email: str
    role: str
    grade_level: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Competencies ────────────────────────────────────────────────────────────

class CompetencyOut(BaseModel):
    competency_id: int
    competency_name: str
    description: Optional[str]
    grade_level: str

    model_config = {"from_attributes": True}


# ─── Materials ───────────────────────────────────────────────────────────────

class MaterialOut(BaseModel):
    material_id: int
    title: str
    subject: str
    competency_id: int
    competency_name: Optional[str] = None   # populated from join
    difficulty_level: str
    content_type: Optional[str]
    duration_minutes: Optional[int]

    model_config = {"from_attributes": True}


class MaterialDetail(MaterialOut):
    file_path: Optional[str]


# ─── Recommendations ─────────────────────────────────────────────────────────

class RecommendationRequest(BaseModel):
    limit: int = 5
    subject: Optional[str] = None


class RecommendedMaterial(BaseModel):
    material_id: int
    title: str
    subject: str
    competency_name: str
    grade_level: str
    difficulty_level: str
    content_type: Optional[str]
    duration_minutes: Optional[int]
    confidence_score: float
    current_mastery: float


class MarkViewedRequest(BaseModel):
    material_id: int
    time_spent_seconds: Optional[int] = 0
    quiz_score: Optional[int] = None


# ─── Progress ────────────────────────────────────────────────────────────────

class MasteryEntry(BaseModel):
    competency_name: str
    mastery_score: float
    last_updated: datetime

    model_config = {"from_attributes": True}


class RecentInteraction(BaseModel):
    material_title: str
    subject: str
    quiz_score: Optional[int]
    time_spent_seconds: Optional[int]
    timestamp: datetime


class StudentProgressOut(BaseModel):
    user_id: int
    full_name: str
    grade_level: Optional[str]
    overall_mastery: float
    total_interactions: int
    competency_mastery: List[MasteryEntry]
    recent_interactions: List[RecentInteraction]


# ─── Analytics (Teacher) ─────────────────────────────────────────────────────

class StudentSummary(BaseModel):
    user_id: int
    full_name: str
    grade_level: Optional[str]
    overall_mastery: float
    total_interactions: int


class CompetencyHeatmapRow(BaseModel):
    competency_name: str
    grade_level: str
    avg_mastery: float
    student_count: int


class ClassAnalyticsOut(BaseModel):
    total_students: int
    total_materials: int
    total_interactions: int
    students: List[StudentSummary]
    competency_heatmap: List[CompetencyHeatmapRow]


# ─── System ──────────────────────────────────────────────────────────────────

class HealthCheck(BaseModel):
    message: str
    version: str
    status: str
    db_connected: bool
    model_loaded: bool
