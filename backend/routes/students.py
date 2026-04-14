"""
Student Routes
GET  /api/students/me/progress        — authenticated student's full progress dashboard
POST /api/students/me/upload-results  — upload competency-level test scores
POST /api/students/me/subject-grades  — upload report-card subject grades
GET  /api/students/me/subject-grades  — fetch stored subject grades
GET  /api/students/{id}/progress      — teacher can view any student's progress
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.auth import get_current_user, require_teacher
from backend.database import get_db
from backend.models import CBCCompetency, InteractionLog, Material, StudentMasteryLog, StudentSubjectGrade, StudentWarning, User
from backend.schemas import (
    MasteryEntry, RecentInteraction, StudentProgressOut,
    TestUploadRequest, TestUploadResponse,
    SubjectGradeUploadRequest, SubjectGradeUploadResponse, SubjectGradeOut,
    TopicGradeUploadRequest, TopicGradeUploadResponse, TopicGradeOut,
    WarningOut,
)

router = APIRouter(prefix="/api/students", tags=["students"])

def _enforce_teacher_school_scope(*, teacher: User, student: User) -> None:
    """
    If the teacher has a school_id set, they may only access students in that school.
    If teacher.school_id is unset, access is not scoped (legacy/demo behavior).
    """
    if teacher.school_id and student.school_id != teacher.school_id:
        raise HTTPException(status_code=403, detail="Student not in your school")


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


@router.post("/me/subject-grades", response_model=SubjectGradeUploadResponse)
def upload_subject_grades(
    payload: SubjectGradeUploadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Student uploads report-card grades by subject (e.g. Mathematics: 75).
    Two things happen:
    1. Grades are stored in student_subject_grades (upsert per subject).
    2. All competencies belonging to that subject have their mastery updated
       using a weighted blend: 50% old mastery + 50% new grade, so that
       the recommendation engine immediately reflects the subject performance.
    """
    for entry in payload.grades:
        subject_norm = entry.subject.strip()
        grade_fraction = entry.grade / 100.0

        # Upsert subject grade row
        existing = (
            db.query(StudentSubjectGrade)
            .filter(
                StudentSubjectGrade.user_id == current_user.user_id,
                func.lower(StudentSubjectGrade.subject) == subject_norm.lower(),
            )
            .first()
        )
        if existing:
            existing.grade = entry.grade
            existing.last_updated = datetime.utcnow()
        else:
            db.add(StudentSubjectGrade(
                user_id=current_user.user_id,
                subject=subject_norm,
                grade=entry.grade,
            ))

        # Propagate to competency mastery: find competencies via materials of this subject
        competency_ids = (
            db.query(Material.competency_id)
            .filter(func.lower(Material.subject) == subject_norm.lower())
            .distinct()
            .all()
        )
        for (comp_id,) in competency_ids:
            mastery_row = (
                db.query(StudentMasteryLog)
                .filter(
                    StudentMasteryLog.user_id == current_user.user_id,
                    StudentMasteryLog.competency_id == comp_id,
                )
                .first()
            )
            if mastery_row:
                mastery_row.mastery_score = round(mastery_row.mastery_score * 0.5 + grade_fraction * 0.5, 4)
                mastery_row.last_updated = datetime.utcnow()
            else:
                db.add(StudentMasteryLog(
                    user_id=current_user.user_id,
                    competency_id=comp_id,
                    mastery_score=round(grade_fraction * 0.5, 4),
                ))

    db.commit()

    saved_grades = (
        db.query(StudentSubjectGrade)
        .filter(StudentSubjectGrade.user_id == current_user.user_id)
        .order_by(StudentSubjectGrade.subject)
        .all()
    )
    return SubjectGradeUploadResponse(
        saved=len(payload.grades),
        subject_grades=[
            SubjectGradeOut(subject=g.subject, grade=g.grade, last_updated=g.last_updated)
            for g in saved_grades
        ],
    )


@router.get("/me/subject-grades", response_model=list[SubjectGradeOut])
def get_subject_grades(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all stored subject grades for the authenticated student."""
    grades = (
        db.query(StudentSubjectGrade)
        .filter(StudentSubjectGrade.user_id == current_user.user_id)
        .order_by(StudentSubjectGrade.subject)
        .all()
    )
    return [SubjectGradeOut(subject=g.subject, grade=g.grade, last_updated=g.last_updated) for g in grades]


@router.post("/me/topic-grades", response_model=TopicGradeUploadResponse)
def upload_topic_grades(
    payload: TopicGradeUploadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Student uploads topic/competency grades (0–100) for better recommendations.
    Each entry is upserted by (subject, competency_id, topic).
    """
    from sqlalchemy import and_
    from backend.models import StudentTopicGrade

    saved = 0
    for entry in payload.grades:
        subject_norm = entry.subject.strip()
        topic_norm = (entry.topic or "").strip() or None
        comp_id = entry.competency_id

        # If a competency_id is provided, ensure it exists
        if comp_id is not None:
            exists = db.query(CBCCompetency).filter(CBCCompetency.competency_id == comp_id).first()
            if not exists:
                raise HTTPException(status_code=400, detail=f"competency_id {comp_id} not found")

        q = db.query(StudentTopicGrade).filter(
            StudentTopicGrade.user_id == current_user.user_id,
            and_(
                StudentTopicGrade.subject == subject_norm,
                (StudentTopicGrade.competency_id == comp_id)
                if comp_id is not None
                else StudentTopicGrade.competency_id.is_(None),
                (func.lower(StudentTopicGrade.topic) == topic_norm.lower())
                if topic_norm is not None
                else StudentTopicGrade.topic.is_(None),
            )
        )
        existing = q.first()
        if existing:
            existing.grade = entry.grade
        else:
            db.add(StudentTopicGrade(
                user_id=current_user.user_id,
                subject=subject_norm,
                competency_id=comp_id,
                topic=topic_norm,
                grade=entry.grade,
            ))
        saved += 1

    db.commit()

    rows = (
        db.query(StudentTopicGrade)
        .filter(StudentTopicGrade.user_id == current_user.user_id)
        .order_by(StudentTopicGrade.subject, StudentTopicGrade.last_updated.desc())
        .all()
    )
    return TopicGradeUploadResponse(
        saved=saved,
        topic_grades=[
            TopicGradeOut(
                id=r.id,
                subject=r.subject,
                grade=r.grade,
                competency_id=r.competency_id,
                topic=r.topic,
                last_updated=r.last_updated,
            )
            for r in rows
        ],
    )


@router.get("/me/topic-grades", response_model=list[TopicGradeOut])
def get_topic_grades(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all stored topic/competency grades for the authenticated student."""
    from backend.models import StudentTopicGrade

    rows = (
        db.query(StudentTopicGrade)
        .filter(StudentTopicGrade.user_id == current_user.user_id)
        .order_by(StudentTopicGrade.subject, StudentTopicGrade.last_updated.desc())
        .all()
    )
    return [
        TopicGradeOut(
            id=r.id,
            subject=r.subject,
            grade=r.grade,
            competency_id=r.competency_id,
            topic=r.topic,
            last_updated=r.last_updated,
        )
        for r in rows
    ]


@router.get("/me/warnings", response_model=list[WarningOut])
def get_my_warnings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all unread warnings for the authenticated student."""
    warnings = (
        db.query(StudentWarning)
        .filter(StudentWarning.user_id == current_user.user_id, StudentWarning.is_read == False)  # noqa: E712
        .order_by(StudentWarning.sent_at.desc())
        .all()
    )
    return [WarningOut(
        warning_id=w.warning_id,
        message=w.message,
        sent_at=w.sent_at,
        is_read=w.is_read,
    ) for w in warnings]


@router.post("/me/warnings/{warning_id}/read", status_code=204)
def dismiss_warning(
    warning_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a warning as read (dismiss it)."""
    warning = db.query(StudentWarning).filter(
        StudentWarning.warning_id == warning_id,
        StudentWarning.user_id == current_user.user_id,
    ).first()
    if warning:
        warning.is_read = True
        db.commit()


@router.get("/{student_id}/progress", response_model=StudentProgressOut)
def student_progress(
    student_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    """Teacher-only: view any student's progress."""
    user = db.query(User).filter(User.user_id == student_id, User.role == "student").first()
    if not user:
        raise HTTPException(status_code=404, detail="Student not found")
    _enforce_teacher_school_scope(teacher=teacher, student=user)
    return _build_progress(user, db)
