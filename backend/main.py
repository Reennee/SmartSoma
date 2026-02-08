"""
SmartSoma Backend API
FastAPI server for personalized learning recommendations
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
from datetime import datetime
import uvicorn

# Initialize FastAPI app
app = FastAPI(
    title="SmartSoma API",
    description="AI-powered educational recommender system for Rwandan secondary students",
    version="1.0.0"
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load data at startup
students_df = None
materials_df = None
interactions_df = None

@app.on_event("startup")
async def load_data():
    """Load datasets on server startup"""
    global students_df, materials_df, interactions_df
    try:
        students_df = pd.read_csv("data/students.csv")
        materials_df = pd.read_csv("data/materials.csv")
        interactions_df = pd.read_csv("data/interactions.csv")
        print("✅ Data loaded successfully")
    except Exception as e:
        print(f"❌ Error loading data: {e}")

# Pydantic models for request/response
class RecommendationRequest(BaseModel):
    student_id: int
    limit: int = 5
    subject: Optional[str] = None

class Material(BaseModel):
    material_id: int
    title: str
    subject: str
    competency: str
    grade_level: str
    difficulty: str
    predicted_mastery: float
    relevance_score: float

class InteractionLog(BaseModel):
    student_id: int
    material_id: int
    duration_seconds: int
    score: int
    completed: bool

class StudentProgress(BaseModel):
    student_id: int
    student_name: str
    grade_level: str
    overall_mastery: float
    competency_mastery: dict
    total_interactions: int
    recent_performance: List[dict]

# ====== API ENDPOINTS ======

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "SmartSoma API is running",
        "version": "1.0.0",
        "status": "healthy"
    }

@app.get("/api/stats")
async def get_stats():
    """Get system statistics"""
    return {
        "students": len(students_df),
        "materials": len(materials_df),
        "interactions": len(interactions_df),
        "subjects": materials_df['subject'].unique().tolist(),
        "grade_levels": students_df['grade_level'].unique().tolist()
    }

@app.post("/api/recommend", response_model=List[Material])
async def get_recommendations(request: RecommendationRequest):
    """
    Get personalized material recommendations for a student
    Uses hybrid filtering (content-based + collaborative)
    """
    try:
        # Get student info
        student = students_df[students_df['student_id'] == request.student_id]
        if student.empty:
            raise HTTPException(status_code=404, detail="Student not found")
        
        student = student.iloc[0]
        
        # Get student's interaction history
        student_interactions = interactions_df[
            interactions_df['student_id'] == request.student_id
        ]
        
        # Calculate mastery by competency
        competency_mastery = student_interactions.groupby('competency')['mastery_level'].mean().to_dict()
        
        # Filter materials
        available_materials = materials_df.copy()
        if request.subject:
            available_materials = available_materials[
                available_materials['subject'] == request.subject
            ]
        
        # Simple recommendation logic
        # Priority 1: Match grade level
        # Priority 2: Focus on low-mastery competencies
        # Priority 3: Progressive difficulty
        
        recommendations = []
        for _, material in available_materials.iterrows():
            # Skip if already mastered
            already_studied = student_interactions[
                student_interactions['material_id'] == material['material_id']
            ]
            
            competency = material['competency']
            current_mastery = competency_mastery.get(competency, 0.3)
            
            # Calculate relevance score
            grade_match = 1.0 if material['grade_level'] == student['grade_level'] else 0.7
            mastery_gap = 1.0 - current_mastery  # Higher for lower mastery
            difficulty_bonus = {"Beginner": 1.0, "Intermediate": 0.9, "Advanced": 0.8}.get(
                material['difficulty'], 0.5
            )
            
            relevance_score = (grade_match * 0.4) + (mastery_gap * 0.4) + (difficulty_bonus * 0.2)
            
            if not already_studied.empty:
                relevance_score *= 0.5  # Penalize already studied
            
            recommendations.append({
                "material_id": int(material['material_id']),
                "title": material['title'],
                "subject": material['subject'],
                "competency": material['competency'],
                "grade_level": material['grade_level'],
                "difficulty": material['difficulty'],
                "predicted_mastery": round(current_mastery + 0.1, 3),  # Optimistic prediction
                "relevance_score": round(relevance_score, 3)
            })
        
        # Sort by relevance and return top K
        recommendations.sort(key=lambda x: x['relevance_score'], reverse=True)
        return recommendations[:request.limit]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/track-interaction")
async def track_interaction(log: InteractionLog):
    """Log a student interaction with a material"""
    global interactions_df
    
    try:
        # Get student's current mastery for this material's competency
        material = materials_df[materials_df['material_id'] == log.material_id].iloc[0]
        
        student_interactions = interactions_df[
            (interactions_df['student_id'] == log.student_id) &
            (interactions_df['competency'] == material['competency'])
        ]
        
        current_mastery = student_interactions['mastery_level'].mean() if len(student_interactions) > 0 else 0.3
        
        # Simple mastery update: increase by score percentage
        new_mastery = min(1.0, current_mastery + (log.score / 100) * 0.1)
        
        # Create new interaction record
        new_interaction = {
            'interaction_id': len(interactions_df) + 1,
            'student_id': log.student_id,
            'material_id': log.material_id,
            'timestamp': datetime.now().isoformat(),
            'duration_seconds': log.duration_seconds,
            'score': log.score,
            'mastery_level': round(new_mastery, 3),
            'completed': log.completed,
            'competency': material['competency'],
            'subject': material['subject']
        }
        
        # Append to dataframe (in production, use database)
        interactions_df = pd.concat([interactions_df, pd.DataFrame([new_interaction])], ignore_index=True)
        
        return {
            "success": True,
            "new_mastery": round(new_mastery, 3),
            "message": "Interaction logged successfully"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/student/{student_id}/progress", response_model=StudentProgress)
async def get_student_progress(student_id: int):
    """Get comprehensive progress dashboard for a student"""
    try:
        # Get student info
        student = students_df[students_df['student_id'] == student_id]
        if student.empty:
            raise HTTPException(status_code=404, detail="Student not found")
        
        student = student.iloc[0]
        
        # Get interactions
        student_interactions = interactions_df[
            interactions_df['student_id'] == student_id
        ].sort_values('timestamp', ascending=False)
        
        if student_interactions.empty:
            return StudentProgress(
                student_id=student_id,
                student_name=student['name'],
                grade_level=student['grade_level'],
                overall_mastery=0.0,
                competency_mastery={},
                total_interactions=0,
                recent_performance=[]
            )
        
        # Calculate competency mastery
        competency_mastery = student_interactions.groupby('competency')['mastery_level'].mean().to_dict()
        competency_mastery = {k: round(v, 3) for k, v in competency_mastery.items()}
        
        # Overall mastery
        overall_mastery = round(student_interactions['mastery_level'].mean(), 3)
        
        # Recent performance
        recent = student_interactions.head(10)[
            ['timestamp', 'subject', 'competency', 'score', 'mastery_level']
        ].to_dict('records')
        
        return StudentProgress(
            student_id=student_id,
            student_name=student['name'],
            grade_level=student['grade_level'],
            overall_mastery=overall_mastery,
            competency_mastery=competency_mastery,
            total_interactions=len(student_interactions),
            recent_performance=recent
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/materials")
async def get_all_materials(
    subject: Optional[str] = None,
    grade_level: Optional[str] = None,
    competency: Optional[str] = None
):
    """Get all materials with optional filtering"""
    filtered = materials_df.copy()
    
    if subject:
        filtered = filtered[filtered['subject'] == subject]
    if grade_level:
        filtered = filtered[filtered['grade_level'] == grade_level]
    if competency:
        filtered = filtered[filtered['competency'] == competency]
    
    return filtered.to_dict('records')

# Run server
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
