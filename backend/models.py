"""
SmartSoma ORM Models
Exactly mirrors the ERD from the project proposal (Chapter 3, Section 3.5.1).
6 tables: users, cbc_competencies, materials, student_mastery_logs,
          recommendations, interaction_logs
"""

from datetime import datetime
from sqlalchemy import (
    Column, Index, Integer, String, Float, Boolean,
    DateTime, Text, ForeignKey
)
from sqlalchemy.orm import relationship
from backend.database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="student")   # "student" | "teacher"
    grade_level = Column(String(10), nullable=True)                # S1, S2, S3 (students only)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    mastery_logs = relationship("StudentMasteryLog", back_populates="user")
    recommendations = relationship("Recommendation", back_populates="user")
    interactions = relationship("InteractionLog", back_populates="user")


class CBCCompetency(Base):
    __tablename__ = "cbc_competencies"

    competency_id = Column(Integer, primary_key=True, index=True)
    competency_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    grade_level = Column(String(10), nullable=False)

    # Relationships
    materials = relationship("Material", back_populates="competency")
    mastery_logs = relationship("StudentMasteryLog", back_populates="competency")


class Material(Base):
    __tablename__ = "materials"
    __table_args__ = (
        Index("ix_material_subject", "subject"),
        Index("ix_material_competency_id", "competency_id"),
        Index("ix_material_difficulty", "difficulty_level"),
    )

    material_id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    file_path = Column(String(500), nullable=True)
    subject = Column(String(100), nullable=False)           # Mathematics | Physics
    competency_id = Column(Integer, ForeignKey("cbc_competencies.competency_id"), nullable=False)
    difficulty_level = Column(String(20), nullable=False)   # Beginner | Intermediate | Advanced
    content_type = Column(String(50), nullable=True)        # PDF | Video | Interactive Exercise
    duration_minutes = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    competency = relationship("CBCCompetency", back_populates="materials")
    recommendations = relationship("Recommendation", back_populates="material")
    interactions = relationship("InteractionLog", back_populates="material")


class StudentMasteryLog(Base):
    __tablename__ = "student_mastery_logs"
    __table_args__ = (
        # Composite index: the most common query pattern — fetch all competencies for one student
        Index("ix_mastery_user_competency", "user_id", "competency_id"),
    )

    log_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    competency_id = Column(Integer, ForeignKey("cbc_competencies.competency_id"), nullable=False)
    mastery_score = Column(Float, nullable=False, default=0.0)  # 0.0 – 1.0
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="mastery_logs")
    competency = relationship("CBCCompetency", back_populates="mastery_logs")


class Recommendation(Base):
    __tablename__ = "recommendations"
    __table_args__ = (
        Index("ix_recommendation_user_id", "user_id"),
    )

    rec_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.material_id"), nullable=False)
    confidence_score = Column(Float, nullable=False, default=0.0)  # 0.0 – 1.0
    is_viewed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="recommendations")
    material = relationship("Material", back_populates="recommendations")


class InteractionLog(Base):
    __tablename__ = "interaction_logs"
    __table_args__ = (
        # Composite: student history queries always filter by user + order by time
        Index("ix_interaction_user_timestamp", "user_id", "timestamp"),
        Index("ix_interaction_material_id", "material_id"),
    )

    interaction_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.material_id"), nullable=False)
    time_spent_seconds = Column(Integer, nullable=True)
    quiz_score = Column(Integer, nullable=True)   # 0 – 100
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="interactions")
    material = relationship("Material", back_populates="interactions")
