"""
Student Routes
GET /api/students/me/progress   — authenticated student's full progress dashboard
GET /api/students/{id}/progress — teacher can view any student's progress
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.auth import get_current_user, require_teacher
from backend.database import get_db
from backend.models import CBCCompetency, InteractionLog, Material, StudentMasteryLog, User
from backend.schemas import MasteryEntry, RecentInteraction, StudentProgressOut

router = APIRouter(prefix="/api/students", tags=["students"])


def _build_progress(user: User, db: Session) -> StudentProgressOut:
    """Compile a full progress report for a user."""
    mastery_rows = (
        db.query(StudentMasteryLog)
        .filter(StudentMasteryLog.user_id == user.user_id)
        .all()
    )

    competency_mastery = [
        MasteryEntry(
            competency_name=row.competency.competency_name,
            mastery_score=round(row.mastery_score, 3),
            last_updated=row.last_updated,
        )
        for row in mastery_rows
    ]

    overall = (
        round(sum(r.mastery_score for r in mastery_rows) / len(mastery_rows), 3)
        if mastery_rows
        else 0.0
    )

    # Recent interactions (latest 10)
    recent_rows = (
        db.query(InteractionLog)
        .filter(InteractionLog.user_id == user.user_id)
        .order_by(InteractionLog.timestamp.desc())
        .limit(10)
        .all()
    )
    recent = [
        RecentInteraction(
            material_title=row.material.title,
            subject=row.material.subject,
            quiz_score=row.quiz_score,
            time_spent_seconds=row.time_spent_seconds,
            timestamp=row.timestamp,
        )
        for row in recent_rows
    ]

    total_interactions = (
        db.query(InteractionLog)
        .filter(InteractionLog.user_id == user.user_id)
        .count()
    )

    return StudentProgressOut(
        user_id=user.user_id,
        full_name=user.full_name,
        grade_level=user.grade_level,
        overall_mastery=overall,
        total_interactions=total_interactions,
        competency_mastery=competency_mastery,
        recent_interactions=recent,
    )


@router.get("/me/progress", response_model=StudentProgressOut)
def my_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the authenticated student's full progress."""
    return _build_progress(current_user, db)


@router.get("/{student_id}/progress", response_model=StudentProgressOut)
def student_progress(
    student_id: int,
    db: Session = Depends(get_db),
    _teacher: User = Depends(require_teacher),
):
    """Teacher-only: view any student's progress."""
    user = db.query(User).filter(User.user_id == student_id, User.role == "student").first()
    if not user:
        raise HTTPException(status_code=404, detail="Student not found")
    return _build_progress(user, db)
