"""
Student Routes
GET /api/students/me/progress   — authenticated student's full progress dashboard
GET /api/students/{id}/progress — teacher can view any student's progress
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.auth import get_current_user, require_teacher
from backend.database import get_db
from backend.models import CBCCompetency, InteractionLog, Material, StudentMasteryLog, User
from backend.schemas import MasteryEntry, RecentInteraction, StudentProgressOut, TestUploadRequest, TestUploadResponse

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


@router.post("/me/upload-results", response_model=TestUploadResponse)
def upload_test_results(
    payload: TestUploadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Student uploads scores from an external exam.
    Each entry maps a competency name → score (0–100).
    Mastery is updated using a weighted blend: 60 % old + 40 % new test score.
    This fires the same mastery update pipeline used by material interactions,
    so the BiLSTM recommendations will immediately reflect the new scores.
    """
    updated = 0
    skipped = 0
    updated_entries: list[MasteryEntry] = []

    for entry in payload.results:
        competency = (
            db.query(CBCCompetency)
            .filter(func.lower(CBCCompetency.competency_name) == entry.competency_name.strip().lower())
            .first()
        )
        if not competency:
            skipped += 1
            continue

        score_fraction = entry.score / 100.0
        mastery_row = (
            db.query(StudentMasteryLog)
            .filter(
                StudentMasteryLog.user_id == current_user.user_id,
                StudentMasteryLog.competency_id == competency.competency_id,
            )
            .first()
        )

        if mastery_row:
            # Weighted blend: trust existing model 60 %, test score 40 %
            mastery_row.mastery_score = round(mastery_row.mastery_score * 0.6 + score_fraction * 0.4, 4)
            mastery_row.last_updated = datetime.utcnow()
        else:
            mastery_row = StudentMasteryLog(
                user_id=current_user.user_id,
                competency_id=competency.competency_id,
                mastery_score=round(score_fraction * 0.4, 4),
            )
            db.add(mastery_row)

        db.flush()
        updated_entries.append(MasteryEntry(
            competency_name=competency.competency_name,
            mastery_score=mastery_row.mastery_score,
            last_updated=mastery_row.last_updated,
        ))
        updated += 1

    db.commit()

    all_mastery = (
        db.query(StudentMasteryLog)
        .filter(StudentMasteryLog.user_id == current_user.user_id)
        .all()
    )
    new_overall = round(sum(r.mastery_score for r in all_mastery) / len(all_mastery), 3) if all_mastery else 0.0

    return TestUploadResponse(
        updated=updated,
        skipped=skipped,
        new_overall_mastery=new_overall,
        updated_competencies=updated_entries,
    )


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
