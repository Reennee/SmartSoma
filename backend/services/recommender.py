"""
SmartSoma Hybrid Recommender
Combines:
  1. Content-Based Filtering (grade match, difficulty progression)
  2. Mastery-Gap Scoring (prioritise competencies with low mastery)
  3. BiLSTM DKT confidence adjustment (optional, graceful fallback)

Returns a ranked list of RecommendedMaterial objects.
"""

from typing import List, Optional

from sqlalchemy.orm import Session

from backend.models import (
    CBCCompetency, InteractionLog, Material,
    StudentMasteryLog, User,
)
from backend.schemas import RecommendedMaterial
from backend.services.dkt import DKTService


class HybridRecommender:
    """Stateless recommender — instantiate once at startup."""

    def recommend(
        self,
        user: User,
        db: Session,
        limit: int = 5,
        subject_filter: Optional[str] = None,
    ) -> List[RecommendedMaterial]:
        # 1 ── Gather student's mastery map: competency_id → score
        mastery_rows = (
            db.query(StudentMasteryLog)
            .filter(StudentMasteryLog.user_id == user.user_id)
            .all()
        )
        mastery_map = {r.competency_id: r.mastery_score for r in mastery_rows}

        # 2 ── Get student's recent interaction history for DKT
        recent_interactions = (
            db.query(InteractionLog)
            .filter(InteractionLog.user_id == user.user_id)
            .order_by(InteractionLog.timestamp.desc())
            .limit(15)
            .all()
        )
        interaction_history = [
            {
                "material_id": i.material_id,
                "score": i.quiz_score or 0,
                "duration": i.time_spent_seconds or 0,
                "mastery": mastery_map.get(i.material.competency_id, 0.3),
            }
            for i in recent_interactions
        ]

        # 3 ── Predict next mastery using BiLSTM DKT
        dkt_confidence = DKTService.predict_mastery(interaction_history)

        # 4 ── Set of already-interacted material IDs (penalise, not exclude)
        seen_ids = {i.material_id for i in recent_interactions}

        # 5 ── Query candidate materials
        q = db.query(Material)
        if subject_filter:
            q = q.filter(Material.subject == subject_filter)
        # Only offer materials matching the student's grade level (or cross-grade for teachers)
        if user.grade_level:
            q = q.join(CBCCompetency).filter(
                CBCCompetency.grade_level == user.grade_level
            )
        candidates = q.all()

        # 6 ── Score each candidate
        scored = []
        difficulty_weights = {"Beginner": 1.0, "Intermediate": 0.85, "Advanced": 0.70}

        for mat in candidates:
            comp_mastery = mastery_map.get(mat.competency_id, 0.3)
            mastery_gap = 1.0 - comp_mastery             # higher gap → higher priority
            difficulty_bonus = difficulty_weights.get(mat.difficulty_level, 0.5)
            novelty = 0.5 if mat.material_id in seen_ids else 1.0

            # Weighted composite score
            raw_score = (
                mastery_gap * 0.50
                + difficulty_bonus * 0.25
                + novelty * 0.15
                + dkt_confidence * 0.10  # DKT nudges toward materials likely to raise mastery
            )
            confidence_score = round(min(raw_score, 1.0), 4)

            scored.append(
                RecommendedMaterial(
                    material_id=mat.material_id,
                    title=mat.title,
                    subject=mat.subject,
                    competency_name=mat.competency.competency_name,
                    grade_level=mat.competency.grade_level,
                    difficulty_level=mat.difficulty_level,
                    content_type=mat.content_type,
                    duration_minutes=mat.duration_minutes,
                    confidence_score=confidence_score,
                    current_mastery=round(comp_mastery, 3),
                )
            )

        # 7 ── Sort descending by confidence_score, return top K
        scored.sort(key=lambda x: x.confidence_score, reverse=True)
        return scored[:limit]
