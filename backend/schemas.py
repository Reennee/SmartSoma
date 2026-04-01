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
    school_id: Optional[str] = None    # school / organisation ID

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
    school_id: Optional[str] = None


# ─── Users ───────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    user_id: int
    full_name: str
    email: str
    role: str
    grade_level: Optional[str]
    school_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Competencies ────────────────────────────────────────────────────────────

class CompetencyOut(BaseModel):
    competency_id: int
    competency_name: str
    description: Optional[str]
    grade_level: str
    subject: Optional[str] = None   # derived from associated materials

    model_config = {"from_attributes": True}


# ─── Materials ───────────────────────────────────────────────────────────────

class MaterialOut(BaseModel):
    material_id: int
    title: str
    description: Optional[str] = None
    subject: str
    competency_id: int
    competency_name: Optional[str] = None   # populated from join
    grade_level: Optional[str] = None       # populated from competency join
    difficulty_level: str
    content_type: Optional[str]
    duration_minutes: Optional[int]
    file_url: Optional[str] = None
    file_path: Optional[str] = None         # local static path
    extracted_text: Optional[str] = None
    extraction_status: Optional[str] = None  # "pending" | "done" | "failed"
    extraction_error: Optional[str] = None   # human-readable failure reason

    model_config = {"from_attributes": True}


class MaterialDetail(MaterialOut):
    pass  # file_path and grade_level are now part of MaterialOut


class PagedMaterials(BaseModel):
    items: List[MaterialOut]
    total: int
    skip: int
    limit: int


# ─── Recommendations ─────────────────────────────────────────────────────────

class RecommendationRequest(BaseModel):
    limit: int = 5
    subject: Optional[str] = None


class RecommendedMaterial(BaseModel):
    material_id: int
    title: str
    description: Optional[str] = None
    subject: str
    competency_name: str
    grade_level: str
    difficulty_level: str
    content_type: Optional[str]
    duration_minutes: Optional[int]
    file_url: Optional[str] = None
    file_path: Optional[str] = None   # local static path served by FastAPI
    extracted_text: Optional[str] = None
    extraction_status: Optional[str] = None  # "pending" | "done" | "failed"
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


# ─── Test Result Upload ──────────────────────────────────────────────────────

class TestResultEntry(BaseModel):
    """A single competency score from an external exam (0–100)."""
    competency_name: str
    score: float  # 0–100

    @field_validator("score")
    @classmethod
    def score_must_be_valid(cls, v: float) -> float:
        if not 0 <= v <= 100:
            raise ValueError("score must be between 0 and 100")
        return v


class TestUploadRequest(BaseModel):
    results: List[TestResultEntry]


class TestUploadResponse(BaseModel):
    updated: int           # competencies successfully updated
    skipped: int           # competency names not found in DB
    new_overall_mastery: float
    updated_competencies: List[MasteryEntry]


# ─── Subject Grade Upload ────────────────────────────────────────────────────

class SubjectGradeEntry(BaseModel):
    """A student's report-card grade for one subject (0–100)."""
    subject: str
    grade: float  # 0–100

    @field_validator("grade")
    @classmethod
    def grade_must_be_valid(cls, v: float) -> float:
        if not 0 <= v <= 100:
            raise ValueError("grade must be between 0 and 100")
        return v


class SubjectGradeUploadRequest(BaseModel):
    grades: List[SubjectGradeEntry]


class SubjectGradeOut(BaseModel):
    subject: str
    grade: float
    last_updated: datetime

    model_config = {"from_attributes": True}


class SubjectGradeUploadResponse(BaseModel):
    saved: int
    subject_grades: List[SubjectGradeOut]


# ─── Material Create / Preview (Teacher) ─────────────────────────────────────

class MaterialCreate(BaseModel):
    title: str
    description: Optional[str] = None
    file_url: Optional[str] = None
    subject: str
    competency_id: int
    difficulty_level: str
    content_type: Optional[str] = None
    duration_minutes: Optional[int] = None
    extract_content: bool = False   # if True, extract text from file_url in background


class MaterialPreviewRequest(BaseModel):
    url: str


class MaterialPreviewResponse(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    competency_name: Optional[str] = None   # Claude picks from valid list
    grade_level: Optional[str] = None
    difficulty_level: Optional[str] = None
    content_type: Optional[str] = None
    duration_minutes: Optional[int] = None
    file_url: str
    link_type: str   # "youtube" | "pdf" | "webpage"


# ─── At-Risk / Warnings ──────────────────────────────────────────────────────

class AtRiskStudent(BaseModel):
    user_id: int
    full_name: str
    grade_level: Optional[str]
    overall_mastery: float
    total_interactions: int
    last_interaction: Optional[datetime]
    warning_already_sent: bool


class WarnStudentRequest(BaseModel):
    message: Optional[str] = None


class WarningOut(BaseModel):
    warning_id: int
    message: str
    sent_at: datetime
    is_read: bool

    model_config = {"from_attributes": True}


# ─── System ──────────────────────────────────────────────────────────────────

class HealthCheck(BaseModel):
    model_config = {"protected_namespaces": ()}

    message: str
    version: str
    status: str
    db_connected: bool
    model_loaded: bool
