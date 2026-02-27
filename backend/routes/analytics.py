"""
Analytics Routes (Teacher-only)
GET /api/analytics/class   — class-wide overview + competency heatmap
GET /api/analytics/stats   — system-wide counts (public health check)
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.auth import require_teacher
from backend.database import get_db
from backend.models import (
    CBCCompetency, InteractionLog, Material,
    StudentMasteryLog, User,
)
from backend.schemas import ClassAnalyticsOut, CompetencyHeatmapRow, StudentSummary

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/class", response_model=ClassAnalyticsOut)
def class_analytics(
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher),
):
    """
    Teacher dashboard: all students' mastery summaries + competency heatmap.
    """
    students = db.query(User).filter(User.role == "student").all()

    student_summaries = []
    for student in students:
        mastery_rows = (
            db.query(StudentMasteryLog)
            .filter(StudentMasteryLog.user_id == student.user_id)
            .all()
        )
        overall = (
            round(sum(r.mastery_score for r in mastery_rows) / len(mastery_rows), 3)
            if mastery_rows
            else 0.0
        )
        total = (
            db.query(InteractionLog)
            .filter(InteractionLog.user_id == student.user_id)
            .count()
        )
        student_summaries.append(
            StudentSummary(
                user_id=student.user_id,
                full_name=student.full_name,
                grade_level=student.grade_level,
                overall_mastery=overall,
                total_interactions=total,
            )
        )

    # Competency heatmap: average mastery per competency across all students
    heatmap_rows = (
        db.query(
            CBCCompetency.competency_name,
            CBCCompetency.grade_level,
            func.avg(StudentMasteryLog.mastery_score).label("avg_mastery"),
            func.count(StudentMasteryLog.user_id).label("student_count"),
        )
        .join(StudentMasteryLog, CBCCompetency.competency_id == StudentMasteryLog.competency_id)
        .group_by(CBCCompetency.competency_id)
        .all()
    )

    heatmap = [
        CompetencyHeatmapRow(
            competency_name=r.competency_name,
            grade_level=r.grade_level,
            avg_mastery=round(r.avg_mastery, 3),
            student_count=r.student_count,
        )
        for r in heatmap_rows
    ]

    total_materials = db.query(Material).count()
    total_interactions = db.query(InteractionLog).count()

    return ClassAnalyticsOut(
        total_students=len(students),
        total_materials=total_materials,
        total_interactions=total_interactions,
        students=student_summaries,
        competency_heatmap=heatmap,
    )


@router.get("/stats")
def system_stats(db: Session = Depends(get_db)):
    """Public endpoint: system-wide counts for the landing page."""
    return {
        "students": db.query(User).filter(User.role == "student").count(),
        "materials": db.query(Material).count(),
        "interactions": db.query(InteractionLog).count(),
        "competencies": db.query(CBCCompetency).count(),
    }
