"""
Auth Routes
POST /api/auth/register  — create a new user account
POST /api/auth/login     — returns a JWT bearer token
GET  /api/auth/me        — returns the current authenticated user
"""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.auth import (
    hash_password, verify_password,
    create_access_token, get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from backend.database import get_db
from backend.models import User, School
from backend.schemas import (
    RegisterRequest, LoginRequest, TokenResponse, UserOut
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new student or teacher account."""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Find or create the school record
    school_fk = None
    school_name = payload.school_name.strip() if payload.school_name else None
    if school_name:
        school = db.query(School).filter(School.name == school_name).first()
        if not school:
            school = School(name=school_name)
            db.add(school)
            db.flush()
        school_fk = school.school_id

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        grade_level=payload.grade_level,
        school_id=school_name,   # store name for display in navbar / analytics filter
        school_fk=school_fk,     # FK to schools table for the auto-assigned integer ID
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        {"sub": str(user.user_id)},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return TokenResponse(
        access_token=token,
        role=user.role,
        user_id=user.user_id,
        full_name=user.full_name,
        school_id=user.school_id,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate and return a JWT token."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    token = create_access_token(
        {"sub": str(user.user_id)},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return TokenResponse(
        access_token=token,
        role=user.role,
        user_id=user.user_id,
        full_name=user.full_name,
        school_id=user.school_id,
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user
