"""
Recommendations Routes
POST /api/recommend   — get personalized material recommendations for the current student
"""

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import User
from backend.schemas import RecommendationRequest, RecommendedMaterial
from backend.services.recommender import HybridRecommender

router = APIRouter(prefix="/api", tags=["recommendations"])
_recommender = HybridRecommender()


@router.post("/recommend", response_model=list[RecommendedMaterial])
def recommend(
    payload: RecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return top-K personalized material recommendations.
    Uses a hybrid Content-Based + Mastery-Gap scorer,
    with optional BiLSTM DKT confidence adjustment.
    """
    return _recommender.recommend(
        user=current_user,
        db=db,
        limit=payload.limit,
        subject_filter=payload.subject,
    )
