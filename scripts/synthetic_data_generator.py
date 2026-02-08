"""
Synthetic Student Data Generator for SmartSoma
Generates realistic student interaction data for S1-S3 Math and Physics
aligned with the Rwandan Competence-Based Curriculum (CBC)
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import random

# Set random seed for reproducibility
np.random.seed(42)
random.seed(42)

# Rwanda CBC Competencies for S1-S3 Math and Physics
MATH_COMPETENCIES = [
    "Numbers and Operations",
    "Algebra and Equations",
    "Geometry and Measurement",
    "Statistics and Probability",
    "Ratios and Proportions",
    "Functions and Graphs"
]

PHYSICS_COMPETENCIES = [
    "Mechanics and Motion",
    "Forces and Energy",
    "Electricity and Magnetism",
    "Light and Sound",
    "Matter and Heat",
    "Scientific Investigation"
]

DIFFICULTY_LEVELS = ["Beginner", "Intermediate", "Advanced"]
GRADE_LEVELS = ["S1", "S2", "S3"]

def generate_learning_materials(num_materials=100):
    """Generate synthetic learning materials for Math and Physics"""
    materials = []
    
    for i in range(num_materials):
        subject = random.choice(["Mathematics", "Physics"])
        competencies = MATH_COMPETENCIES if subject == "Mathematics" else PHYSICS_COMPETENCIES
        
        material = {
            "material_id": i + 1,
            "title": f"{subject} - {random.choice(competencies)} - Lesson {random.randint(1, 20)}",
            "subject": subject,
            "competency": random.choice(competencies),
            "grade_level": random.choice(GRADE_LEVELS),
            "difficulty": random.choice(DIFFICULTY_LEVELS),
            "content_type": random.choice(["PDF", "Video", "Interactive Exercise"]),
            "duration_minutes": random.randint(10, 60),
            "file_path": f"/materials/{subject.lower()}/lesson_{i+1}.pdf"
        }
        materials.append(material)
    
    return pd.DataFrame(materials)

def generate_students(num_students=50):
    """Generate synthetic student profiles"""
    students = []
    rwandan_names = [
        "Uwera", "Mugisha", "Mutoni", "Niyonzima", "Uwamahoro",
        "Habimana", "Nkurunziza", "Iradukunda", "Nsabimana", "Mukantwari"
    ]
    
    for i in range(num_students):
        student = {
            "student_id": i + 1,
            "name": f"{random.choice(rwandan_names)} {random.choice(rwandan_names)}",
            "grade_level": random.choice(GRADE_LEVELS),
            "baseline_ability": np.random.beta(5, 2),  # Skewed toward higher ability
            "learning_rate": np.random.uniform(0.02, 0.08),  # How fast they improve
            "consistency": np.random.uniform(0.6, 0.95)  # How consistent their performance is
        }
        students.append(student)
    
    return pd.DataFrame(students)

def simulate_mastery_progression(student, material, previous_mastery):
    """
    Simulate realistic mastery progression using learning curve model
    
    Factors:
    - Student baseline ability
    - Material difficulty
    - Previous mastery level
    - Learning rate
    - Random noise for realism
    """
    difficulty_multiplier = {
        "Beginner": 1.0,
        "Intermediate": 0.85,
        "Advanced": 0.7
    }
    
    # Calculate expected mastery gain
    difficulty_factor = difficulty_multiplier[material["difficulty"]]
    learning_gain = student["learning_rate"] * difficulty_factor
    
    # Natural learning curve: harder to improve at higher mastery
    diminishing_returns = 1 - (previous_mastery * 0.5)
    
    # Calculate new mastery with noise
    mastery_increase = learning_gain * diminishing_returns
    noise = np.random.normal(0, 0.05) * student["consistency"]
    
    new_mastery = min(1.0, max(0.0, previous_mastery + mastery_increase + noise))
    
    return new_mastery

def generate_interactions(students_df, materials_df, num_interactions=1000):
    """Generate realistic student-material interaction sequences"""
    interactions = []
    
    # Track each student's mastery by competency
    student_competency_mastery = {}
    
    start_date = datetime(2025, 9, 1)  # Start of academic year
    
    for _ in range(num_interactions):
        # Select random student and material
        student = students_df.sample(1).iloc[0]
        material = materials_df.sample(1).iloc[0]
        
        # Initialize mastery tracking
        key = (student["student_id"], material["competency"])
        if key not in student_competency_mastery:
            student_competency_mastery[key] = student["baseline_ability"] * 0.3
        
        previous_mastery = student_competency_mastery[key]
        
        # Simulate interaction
        new_mastery = simulate_mastery_progression(
            student.to_dict(), 
            material.to_dict(), 
            previous_mastery
        )
        
        # Update tracking
        student_competency_mastery[key] = new_mastery
        
        # Calculate interaction metrics
        time_spent = int(material["duration_minutes"] * np.random.uniform(0.7, 1.3))
        score = min(100, max(0, int(new_mastery * 100 + np.random.normal(0, 10))))
        completed = random.random() < student["consistency"]
        
        interaction = {
            "interaction_id": len(interactions) + 1,
            "student_id": int(student["student_id"]),
            "material_id": int(material["material_id"]),
            "timestamp": start_date + timedelta(days=random.randint(0, 120)),
            "duration_seconds": time_spent * 60,
            "score": score,
            "mastery_level": round(new_mastery, 3),
            "completed": completed,
            "competency": material["competency"],
            "subject": material["subject"]
        }
        interactions.append(interaction)
    
    # Sort by timestamp to create realistic sequences
    interactions_df = pd.DataFrame(interactions)
    interactions_df = interactions_df.sort_values(["student_id", "timestamp"])
    
    return interactions_df

def main():
    """Generate and save all synthetic datasets"""
    print("🎓 SmartSoma Synthetic Data Generator")
    print("=" * 50)
    
    # Generate datasets
    print("\n📚 Generating learning materials...")
    materials_df = generate_learning_materials(num_materials=100)
    print(f"   ✓ Created {len(materials_df)} materials")
    
    print("\n👨‍🎓 Generating student profiles...")
    students_df = generate_students(num_students=50)
    print(f"   ✓ Created {len(students_df)} students")
    
    print("\n📊 Generating student interactions...")
    interactions_df = generate_interactions(students_df, materials_df, num_interactions=1200)
    print(f"   ✓ Created {len(interactions_df)} interactions")
    
    # Save to CSV
    print("\n💾 Saving datasets...")
    materials_df.to_csv("data/materials.csv", index=False)
    students_df.to_csv("data/students.csv", index=False)
    interactions_df.to_csv("data/interactions.csv", index=False)
    
    print("\n✅ Data generation complete!")
    print("\nDataset Summary:")
    print(f"   • Students: {len(students_df)}")
    print(f"   • Materials: {len(materials_df)}")
    print(f"   • Interactions: {len(interactions_df)}")
    print(f"   • Subjects: Mathematics, Physics")
    print(f"   • Grade Levels: S1, S2, S3")
    print(f"   • Competencies: {len(MATH_COMPETENCIES + PHYSICS_COMPETENCIES)}")
    
    # Display sample data
    print("\n📋 Sample Interaction Data:")
    print(interactions_df.head(3))
    
    return students_df, materials_df, interactions_df

if __name__ == "__main__":
    main()
