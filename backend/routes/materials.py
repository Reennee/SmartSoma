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

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy import case
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import (
    CBCCompetency, InteractionLog, Material,
    StudentMasteryLog, User,
)
from backend.schemas import (
    CompetencyOut, MarkViewedRequest, MaterialCreate, MaterialUpdate,
    MaterialDetail, MaterialOut, MaterialPreviewRequest,
    MaterialPreviewResponse, PagedMaterials,
)

router = APIRouter(prefix="/api/materials", tags=["materials"])


def _enrich(material: Material) -> dict:
    """Add competency_name and grade_level to a material row for the response."""
    d = {c.name: getattr(material, c.name) for c in material.__table__.columns}
    d["competency_name"] = material.competency.competency_name if material.competency else ""
    d["grade_level"] = material.competency.grade_level if material.competency else None
    return d


def _do_extract(material_id: int) -> None:
    """
    Background task: download a PDF, save it locally under /static/materials/,
    extract its text, and update file_path + extracted_text on the material row.
    For YouTube links, text extraction is skipped (no downloadable content).
    """
    from pathlib import Path
    import re as _re
    import requests as _req
    from backend.database import SessionLocal
    from backend.services.extractor import _safe_request, _read_stream_with_cap

    db = SessionLocal()
    mat = None
    try:
        mat = db.query(Material).filter(Material.material_id == material_id).first()
        if not mat or not mat.file_url:
            return

        url = mat.file_url

        # YouTube has no downloadable content — leave status as-is (not a failure)
        if "youtube.com" in url or "youtu.be" in url:
            mat.extraction_status = None
            db.commit()
            return

        # ── Download the URL ────────────────────────────────────────────────
        resp = _safe_request("GET", url, stream=True, timeout=30)
        resp.raise_for_status()

        # Validate that the response is actually a PDF, not a login-redirect HTML page
        content_type = resp.headers.get("Content-Type", "")
        if "pdf" not in content_type.lower() and not url.lower().endswith(".pdf"):
            raise ValueError(
                f"URL did not return a PDF file (Content-Type: '{content_type}'). "
                "The link may require login, or may point to a webpage instead of a direct PDF. "
                "Use the direct download URL for the PDF file."
            )

        pdf_bytes = _read_stream_with_cap(resp)

        # Double-check magic bytes — a real PDF starts with %PDF
        if not pdf_bytes.startswith(b"%PDF"):
            raise ValueError(
                "Downloaded file does not appear to be a valid PDF (missing %PDF header). "
                "The URL may redirect to a login page or a different file type."
            )

        # ── Determine save path: static/materials/{subject}/{grade}/{slug}.pdf
        subject_slug = (mat.subject or "general").lower().replace(" ", "-")
        grade = "s1"
        if mat.competency:
            grade = (mat.competency.grade_level or "s1").lower()
        safe_title = _re.sub(r"[^a-z0-9]+", "-", mat.title.lower()).strip("-")[:60]
        filename = f"{safe_title}-{mat.material_id}.pdf"

        static_dir = Path(__file__).parent.parent / "static" / "materials" / subject_slug / grade
        static_dir.mkdir(parents=True, exist_ok=True)
        dest = static_dir / filename
        dest.write_bytes(pdf_bytes)

        mat.file_path = f"/static/materials/{subject_slug}/{grade}/{filename}"

        # ── Extract text ────────────────────────────────────────────────────
        import io
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        parts = [p.extract_text().strip() for p in reader.pages[:50] if p.extract_text()]
        mat.extracted_text = "\n\n".join(parts)[:100_000]
        mat.extraction_status = "done"
        mat.extraction_error = None

    except Exception as exc:
        logger.warning("Extraction failed for material %s: %s", material_id, exc)
        if mat:
            mat.extraction_status = "failed"
            mat.extraction_error = str(exc)[:500]
    finally:
        try:
            resp.close()  # type: ignore[name-defined]
        except Exception:
            pass
        db.commit()
        db.close()


import logging as _logging
logger = _logging.getLogger(__name__)


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
    limit: int = Query(12, ge=1, le=500),
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
    # Order newest “published” first (NULLS LAST), then by created_at/material_id.
    # Portable NULLS LAST: order by (published_at IS NULL) ascending.
    published_nulls_last = case((Material.published_at.is_(None), 1), else_=0)
    materials = (
        q.order_by(
            published_nulls_last.asc(),
            Material.published_at.desc(),
            Material.created_at.desc(),
            Material.material_id.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
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
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new learning material. Teacher-only.
    Pass extract_content=true to trigger background PDF text extraction.
    """
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create materials")

    competency = db.query(CBCCompetency).filter(
        CBCCompetency.competency_id == payload.competency_id
    ).first()
    if not competency:
        raise HTTPException(status_code=400, detail="competency_id not found")

    will_extract = payload.extract_content and bool(payload.file_url)

    material = Material(
        title=payload.title,
        description=payload.description,
        file_url=payload.file_url,
        subject=payload.subject,
        competency_id=payload.competency_id,
        difficulty_level=payload.difficulty_level,
        content_type=payload.content_type,
        duration_minutes=payload.duration_minutes,
        published_at=datetime.utcnow(),
        extraction_status="pending" if will_extract else None,
    )
    db.add(material)
    db.commit()
    db.refresh(material)

    if will_extract:
        background_tasks.add_task(_do_extract, material.material_id)

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


@router.patch("/{material_id}", response_model=MaterialOut)
def update_material(
    material_id: int,
    payload: MaterialUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update editable fields on a material. Teacher-only."""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can edit materials")

    material = db.query(Material).filter(Material.material_id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    if payload.competency_id is not None:
        competency = db.query(CBCCompetency).filter(
            CBCCompetency.competency_id == payload.competency_id
        ).first()
        if not competency:
            raise HTTPException(status_code=400, detail="competency_id not found")

    # Apply only the fields that were explicitly provided
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(material, field, value)

    db.commit()
    db.refresh(material)
    return _enrich(material)


@router.delete("/{material_id}", status_code=204)
def delete_material(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a material and its interaction logs. Teacher-only."""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can delete materials")

    material = db.query(Material).filter(Material.material_id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    # Remove dependent rows first to satisfy FK constraints
    db.query(InteractionLog).filter(InteractionLog.material_id == material_id).delete()
    db.delete(material)
    db.commit()


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
