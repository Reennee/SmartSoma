"""
Analytics Routes (Teacher-only)
GET /api/analytics/class   — class-wide overview + competency heatmap
GET /api/analytics/stats   — system-wide counts (public health check)
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from fastapi import HTTPException
from backend.auth import require_teacher
from backend.database import get_db
from backend.models import (
    CBCCompetency, InteractionLog, Material,
    StudentMasteryLog, StudentWarning, User,
)
from backend.schemas import (
    AtRiskStudent, ClassAnalyticsOut, CompetencyHeatmapRow,
    StudentSummary, WarnStudentRequest,
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/class", response_model=ClassAnalyticsOut)
def class_analytics(
    db: Session = Depends(get_db),
    current_teacher: User = Depends(require_teacher),
):
    """
    Teacher dashboard: all students' mastery summaries + competency heatmap.
    Scoped to the teacher's school if school_id is set.
    """
    q = db.query(User).filter(User.role == "student")
    if current_teacher.school_id:
        q = q.filter(User.school_id == current_teacher.school_id)
    students = q.all()

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


@router.get("/at-risk", response_model=list[AtRiskStudent])
def at_risk_students(
    db: Session = Depends(get_db),
    current_teacher: User = Depends(require_teacher),
):
    """
    Returns students whose mastery is below 40% OR who have fewer than 5 interactions.
    Scoped to the teacher's school if school_id is set.
    Also flags whether a warning has already been sent this week.
    """
    q = db.query(User).filter(User.role == "student")
    if current_teacher.school_id:
        q = q.filter(User.school_id == current_teacher.school_id)
    students = q.all()
    result = []
    for student in students:
        mastery_rows = (
            db.query(StudentMasteryLog)
            .filter(StudentMasteryLog.user_id == student.user_id)
            .all()
        )
        overall = (
            round(sum(r.mastery_score for r in mastery_rows) / len(mastery_rows), 3)
            if mastery_rows else 0.0
        )
        interactions = (
            db.query(InteractionLog)
            .filter(InteractionLog.user_id == student.user_id)
            .order_by(InteractionLog.timestamp.desc())
            .all()
        )
        total = len(interactions)
        last_ts = interactions[0].timestamp if interactions else None

        # Only surface students who need attention
        if overall >= 0.4 and total >= 5:
            continue

        # Check if a warning was sent in the last 7 days
        from datetime import timedelta
        from sqlalchemy import and_
        cutoff = datetime.utcnow() - timedelta(days=7)
        recent_warning = (
            db.query(StudentWarning)
            .filter(
                and_(
                    StudentWarning.user_id == student.user_id,
                    StudentWarning.sent_at >= cutoff,
                )
            )
            .first()
        )

        result.append(
            AtRiskStudent(
                user_id=student.user_id,
                full_name=student.full_name,
                grade_level=student.grade_level,
                overall_mastery=overall,
                total_interactions=total,
                last_interaction=last_ts,
                warning_already_sent=recent_warning is not None,
            )
        )

    result.sort(key=lambda s: s.overall_mastery)
    return result


@router.post("/warn/{student_id}", status_code=201)
def warn_student(
    student_id: int,
    body: WarnStudentRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher),
):
    """Send a warning nudge to an at-risk student."""
    student = db.query(User).filter(
        User.user_id == student_id, User.role == "student"
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    default_msg = (
        "Your teacher has noticed you may need extra support. "
        "Please log in and interact with the recommended materials to improve your mastery."
    )
    warning = StudentWarning(
        user_id=student_id,
        message=body.message or default_msg,
    )
    db.add(warning)
    db.commit()
    return {"sent": True, "student": student.full_name}


@router.get("/stats")
def system_stats(db: Session = Depends(get_db)):
    """Public endpoint: system-wide counts for the landing page."""
    return {
        "students": db.query(User).filter(User.role == "student").count(),
        "materials": db.query(Material).count(),
        "interactions": db.query(InteractionLog).count(),
        "competencies": db.query(CBCCompetency).count(),
    }
