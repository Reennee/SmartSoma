"""
SmartSoma Database Seeder
Reads the existing CSV files and inserts them into the database.
Run from the project root:
    python -m backend.seed

Safe to run multiple times — skips existing records by unique key.
"""

import os
import sys
import csv
from datetime import datetime
from pathlib import Path

# Allow running as a module from the project root
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.database import engine, SessionLocal, Base
from backend.models import (
    CBCCompetency, InteractionLog, Material,
    StudentMasteryLog, User,
)
from backend.auth import hash_password

DATA_DIR = Path(__file__).parent.parent / "data"


def create_tables():
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created / verified")


def seed_competencies(db) -> dict:
    """Extract unique competencies from materials.csv and insert them."""
    competency_map: dict[str, CBCCompetency] = {}

    with open(DATA_DIR / "materials.csv", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row["competency"].strip()
            grade = row["grade_level"].strip()
            key = f"{name}|{grade}"
            if key not in competency_map:
                existing = (
                    db.query(CBCCompetency)
                    .filter(
                        CBCCompetency.competency_name == name,
                        CBCCompetency.grade_level == grade,
                    )
                    .first()
                )
                if not existing:
                    comp = CBCCompetency(
                        competency_name=name,
                        grade_level=grade,
                        description=f"CBC {grade} competency: {name}",
                    )
                    db.add(comp)
                    db.flush()
                    competency_map[key] = comp
                else:
                    competency_map[key] = existing

    db.commit()
    print(f"✅ Seeded {len(competency_map)} competencies")
    return competency_map


def seed_materials(db, competency_map: dict) -> dict:
    """Insert materials from materials.csv."""
    material_id_map: dict[int, int] = {}  # csv_id → db_id

    with open(DATA_DIR / "materials.csv", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            csv_id = int(row["material_id"])
            existing = db.query(Material).filter(Material.material_id == csv_id).first()
            if existing:
                material_id_map[csv_id] = existing.material_id
                continue

            key = f"{row['competency'].strip()}|{row['grade_level'].strip()}"
            comp = competency_map.get(key)
            if not comp:
                continue

            mat = Material(
                material_id=csv_id,
                title=row["title"].strip(),
                file_path=row.get("file_path", "").strip() or None,
                subject=row["subject"].strip(),
                competency_id=comp.competency_id,
                difficulty_level=row["difficulty"].strip(),
                content_type=row.get("content_type", "").strip() or None,
                duration_minutes=int(row["duration_minutes"]) if row.get("duration_minutes") else None,
            )
            db.add(mat)
            db.flush()
            material_id_map[csv_id] = mat.material_id

    db.commit()
    print(f"✅ Seeded {len(material_id_map)} materials")
    return material_id_map


def seed_students(db) -> dict:
    """
    Insert synthetic students from students.csv as User records.
    Each student gets a default password = 'SmartSoma2025!'
    """
    student_id_map: dict[int, int] = {}
    default_pw = hash_password("SmartSoma2025!")

    with open(DATA_DIR / "students.csv", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            csv_id = int(row["student_id"])
            name = row["name"].strip()
            email = f"student{csv_id}@smartsoma.rw"

            existing = db.query(User).filter(User.email == email).first()
            if existing:
                student_id_map[csv_id] = existing.user_id
                continue

            user = User(
                full_name=name,
                email=email,
                password_hash=default_pw,
                role="student",
                grade_level=row["grade_level"].strip(),
            )
            db.add(user)
            db.flush()
            student_id_map[csv_id] = user.user_id

    db.commit()
    print(f"✅ Seeded {len(student_id_map)} students")
    return student_id_map


def seed_teacher(db):
    """Create a default teacher account."""
    email = "teacher@smartsoma.rw"
    if not db.query(User).filter(User.email == email).first():
        teacher = User(
            full_name="Demo Teacher",
            email=email,
            password_hash=hash_password("TeacherPass2025!"),
            role="teacher",
        )
        db.add(teacher)
        db.commit()
        print("✅ Default teacher account created: teacher@smartsoma.rw / TeacherPass2025!")
    else:
        print("ℹ️  Teacher account already exists")


def seed_interactions(db, student_id_map: dict, material_id_map: dict, competency_map: dict):
    """
    Insert interaction logs from interactions.csv.
    Also builds student_mastery_logs from mastery_level column.
    """
    count = 0
    mastery_accumulator: dict[tuple, list] = {}  # (user_id, competency_id) → [scores]

    with open(DATA_DIR / "interactions.csv", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            csv_student_id = int(row["student_id"])
            csv_material_id = int(row["material_id"])

            user_id = student_id_map.get(csv_student_id)
            material_id = material_id_map.get(csv_material_id)
            if not user_id or not material_id:
                continue

            # Parse timestamp
            try:
                ts = datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00"))
            except Exception:
                ts = datetime.utcnow()

            log = InteractionLog(
                user_id=user_id,
                material_id=material_id,
                time_spent_seconds=int(row["duration_seconds"]) if row.get("duration_seconds") else None,
                quiz_score=int(float(row["score"])) if row.get("score") else None,
                timestamp=ts,
            )
            db.add(log)
            count += 1

            # Accumulate mastery per (user, competency)
            mat = db.query(Material).filter(Material.material_id == material_id).first()
            if mat:
                key = (user_id, mat.competency_id)
                mastery_val = float(row.get("mastery_level", 0.0))
                mastery_accumulator.setdefault(key, []).append(mastery_val)

    db.commit()
    print(f"✅ Seeded {count} interaction logs")

    # Build mastery logs from averages
    mastery_count = 0
    for (user_id, competency_id), scores in mastery_accumulator.items():
        avg = round(sum(scores) / len(scores), 4)
        existing = (
            db.query(StudentMasteryLog)
            .filter(
                StudentMasteryLog.user_id == user_id,
                StudentMasteryLog.competency_id == competency_id,
            )
            .first()
        )
        if not existing:
            db.add(StudentMasteryLog(
                user_id=user_id,
                competency_id=competency_id,
                mastery_score=avg,
            ))
            mastery_count += 1

    db.commit()
    print(f"✅ Seeded {mastery_count} mastery log entries")


def run():
    print("\n🚀 SmartSoma Database Seeder")
    print("=" * 40)
    create_tables()
    db = SessionLocal()
    try:
        competency_map = seed_competencies(db)
        material_id_map = seed_materials(db, competency_map)
        student_id_map = seed_students(db)
        seed_teacher(db)
        seed_interactions(db, student_id_map, material_id_map, competency_map)
        print("\n🎉 Seeding complete!")
        print("\nDefault accounts:")
        print("  Student: student1@smartsoma.rw  / SmartSoma2025!")
        print("  Teacher: teacher@smartsoma.rw   / TeacherPass2025!")
    finally:
        db.close()


if __name__ == "__main__":
    run()
