"""
Materials Routes
GET  /api/materials                     — list/filter materials
GET  /api/materials/competencies        — list all CBC competencies
GET  /api/materials/{id}                — material detail
POST /api/materials/preview             — AI-extract metadata from a URL (teacher)
POST /api/materials                     — create a new material (teacher)
POST /api/materials/{id}/interact       — log an interaction + update mastery
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import (
    CBCCompetency, InteractionLog, Material,
    StudentMasteryLog, User,
)
from backend.schemas import (
    CompetencyOut, MarkViewedRequest, MaterialCreate,
    MaterialDetail, MaterialOut, MaterialPreviewRequest,
    MaterialPreviewResponse, PagedMaterials,
)

router = APIRouter(prefix="/api/materials", tags=["materials"])


def _enrich(material: Material) -> dict:
    """Add competency_name to a material row for the response."""
    d = {c.name: getattr(material, c.name) for c in material.__table__.columns}
    d["competency_name"] = material.competency.competency_name if material.competency else ""
    return d


@router.get("/competencies", response_model=list[CompetencyOut])
def list_competencies(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return all CBC competencies with their subject (derived from materials)."""
    rows = db.query(CBCCompetency).order_by(CBCCompetency.grade_level, CBCCompetency.competency_name).all()
    result = []
    for r in rows:
        # Derive subject from the first linked material
        first_mat = db.query(Material).filter(Material.competency_id == r.competency_id).first()
        result.append({
            "competency_id": r.competency_id,
            "competency_name": r.competency_name,
            "grade_level": r.grade_level,
            "description": r.description,
            "subject": first_mat.subject if first_mat else None,
        })
    return result


@router.get("", response_model=PagedMaterials)
def list_materials(
    subject: Optional[str] = None,
    grade_level: Optional[str] = None,
    difficulty_level: Optional[str] = None,
    competency_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(12, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return a page of materials, optionally filtered."""
    q = db.query(Material)
    if subject:
        q = q.filter(Material.subject == subject)
    if difficulty_level:
        q = q.filter(Material.difficulty_level == difficulty_level)
    if competency_id:
        q = q.filter(Material.competency_id == competency_id)
    if grade_level:
        q = q.join(CBCCompetency).filter(CBCCompetency.grade_level == grade_level)

    total = q.count()
    materials = q.offset(skip).limit(limit).all()
    return {"items": [_enrich(m) for m in materials], "total": total, "skip": skip, "limit": limit}


@router.post("/preview", response_model=MaterialPreviewResponse)
def preview_material(
    payload: MaterialPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch a URL and use Claude AI to extract learning material metadata.
    Teacher-only. Does NOT write to the database.
    """
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can use this endpoint")

    from backend.services.extractor import fetch_url_content, extract_metadata

    competencies = [
        row.competency_name
        for row in db.query(CBCCompetency.competency_name).order_by(CBCCompetency.competency_name).all()
    ]

    raw = fetch_url_content(payload.url)
    result = extract_metadata(payload.url, raw, competencies)
    return result


@router.post("", response_model=MaterialOut, status_code=201)
def create_material(
    payload: MaterialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new learning material. Teacher-only.
    """
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create materials")

    competency = db.query(CBCCompetency).filter(
        CBCCompetency.competency_id == payload.competency_id
    ).first()
    if not competency:
        raise HTTPException(status_code=400, detail="competency_id not found")

    material = Material(
        title=payload.title,
        description=payload.description,
        file_url=payload.file_url,
        subject=payload.subject,
        competency_id=payload.competency_id,
        difficulty_level=payload.difficulty_level,
        content_type=payload.content_type,
        duration_minutes=payload.duration_minutes,
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return _enrich(material)


@router.get("/{material_id}", response_model=MaterialDetail)
def get_material(
    material_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    material = db.query(Material).filter(Material.material_id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    return _enrich(material)


@router.post("/{material_id}/interact")
def log_interaction(
    material_id: int,
    payload: MarkViewedRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Log that a student interacted with a material.
    Updates the student_mastery_logs for the relevant competency.
    """
    material = db.query(Material).filter(Material.material_id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    # 1) Append interaction log
    log = InteractionLog(
        user_id=current_user.user_id,
        material_id=material_id,
        time_spent_seconds=payload.time_spent_seconds,
        quiz_score=payload.quiz_score,
        timestamp=datetime.utcnow(),
    )
    db.add(log)

    # 2) Update mastery for the competency
    mastery_row = (
        db.query(StudentMasteryLog)
        .filter(
            StudentMasteryLog.user_id == current_user.user_id,
            StudentMasteryLog.competency_id == material.competency_id,
        )
        .first()
    )

    score_fraction = (payload.quiz_score or 0) / 100.0
    if mastery_row:
        # Weighted moving average: 70% old, 30% new quiz score
        mastery_row.mastery_score = round(
            mastery_row.mastery_score * 0.7 + score_fraction * 0.3, 4
        )
        mastery_row.last_updated = datetime.utcnow()
    else:
        mastery_row = StudentMasteryLog(
            user_id=current_user.user_id,
            competency_id=material.competency_id,
            mastery_score=round(score_fraction * 0.3, 4),
        )
        db.add(mastery_row)

    db.commit()
    return {
        "success": True,
        "new_mastery": mastery_row.mastery_score,
        "competency": material.competency.competency_name,
    }
