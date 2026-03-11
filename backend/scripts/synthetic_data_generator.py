"""
Synthetic Student Data Generator for SmartSoma
Generates realistic student interaction data aligned with the real REB CBC materials.
Does NOT overwrite materials.csv — reads from it to stay in sync.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
from pathlib import Path

# ── Reproducibility ────────────────────────────────────────────────────────────
np.random.seed(42)
random.seed(42)

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / "data"

DIFFICULTY_WEIGHTS = {"Beginner": 1.0, "Intermediate": 0.85, "Advanced": 0.70}
GRADE_LEVELS = ["S1", "S2", "S3"]


def load_materials() -> pd.DataFrame:
    """Load the real REB CBC materials CSV (materials 1–60)."""
    path = DATA_DIR / "materials.csv"
    df = pd.read_csv(path)
    # Keep only the columns the generator needs
    return df[["material_id", "subject", "competency", "grade_level", "difficulty", "duration_minutes"]].copy()


def generate_students(num_students: int = 150) -> pd.DataFrame:
    """Generate synthetic student profiles."""
    rwandan_names = [
        "Uwera", "Mugisha", "Mutoni", "Niyonzima", "Uwamahoro",
        "Habimana", "Nkurunziza", "Iradukunda", "Nsabimana", "Mukantwari",
        "Kayitesi", "Bizimana", "Ndayisaba", "Uwimana", "Rukundo",
        "Gasana", "Munyaneza", "Kabera", "Ingabire", "Nzeyimana",
    ]

    students = []
    for i in range(num_students):
        students.append({
            "student_id": i + 1,
            "name": f"{random.choice(rwandan_names)} {random.choice(rwandan_names)}",
            "grade_level": random.choice(GRADE_LEVELS),
            # Skew slightly toward higher baseline (Rwandan school context)
            "baseline_ability": float(np.random.beta(5, 2)),
            "learning_rate": float(np.random.uniform(0.02, 0.08)),
            "consistency": float(np.random.uniform(0.60, 0.95)),
        })
    return pd.DataFrame(students)


def simulate_mastery_progression(
    baseline_ability: float,
    learning_rate: float,
    consistency: float,
    difficulty: str,
    previous_mastery: float,
) -> float:
    diff_factor = DIFFICULTY_WEIGHTS.get(difficulty, 0.85)
    gain = learning_rate * diff_factor * (1 - previous_mastery * 0.5)
    noise = float(np.random.normal(0, 0.05)) * consistency
    return float(min(1.0, max(0.0, previous_mastery + gain + noise)))


def generate_interactions(
    students_df: pd.DataFrame,
    materials_df: pd.DataFrame,
    num_interactions: int = 5000,
) -> pd.DataFrame:
    """Generate realistic student–material interaction sequences."""
    interactions = []
    mastery_state: dict[tuple, float] = {}  # (student_id, competency) → mastery

    start_date = datetime(2025, 9, 1)

    for idx in range(num_interactions):
        student = students_df.sample(1).iloc[0]
        material = materials_df.sample(1).iloc[0]

        key = (int(student["student_id"]), str(material["competency"]))
        if key not in mastery_state:
            mastery_state[key] = float(student["baseline_ability"]) * 0.3

        prev_mastery = mastery_state[key]
        new_mastery = simulate_mastery_progression(
            baseline_ability=float(student["baseline_ability"]),
            learning_rate=float(student["learning_rate"]),
            consistency=float(student["consistency"]),
            difficulty=str(material["difficulty"]),
            previous_mastery=prev_mastery,
        )
        mastery_state[key] = new_mastery

        duration = int(material["duration_minutes"]) if pd.notna(material["duration_minutes"]) else 30
        time_spent = int(duration * float(np.random.uniform(0.7, 1.3)))
        score = int(min(100, max(0, new_mastery * 100 + float(np.random.normal(0, 10)))))
        completed = random.random() < float(student["consistency"])

        interactions.append({
            "interaction_id": idx + 1,
            "student_id": int(student["student_id"]),
            "material_id": int(material["material_id"]),
            "timestamp": start_date + timedelta(days=random.randint(0, 180)),
            "duration_seconds": time_spent * 60,
            "score": score,
            "mastery_level": round(new_mastery, 3),
            "completed": completed,
            "competency": str(material["competency"]),
            "subject": str(material["subject"]),
        })

    df = pd.DataFrame(interactions)
    df = df.sort_values(["student_id", "timestamp"]).reset_index(drop=True)
    return df


def main():
    print("🎓 SmartSoma Synthetic Data Generator (CBC-aligned)")
    print("=" * 55)

    print("\n📚 Loading real REB materials from materials.csv …")
    materials_df = load_materials()
    print(f"   ✓ Loaded {len(materials_df)} materials  "
          f"(IDs {materials_df['material_id'].min()}–{materials_df['material_id'].max()})")
    print(f"   ✓ Subjects: {dict(materials_df['subject'].value_counts())}")
    print(f"   ✓ Unique competencies: {materials_df['competency'].nunique()}")

    print("\n👨‍🎓 Generating student profiles …")
    students_df = generate_students(num_students=150)
    print(f"   ✓ Created {len(students_df)} students")

    print("\n📊 Generating student interactions …")
    interactions_df = generate_interactions(students_df, materials_df, num_interactions=5000)
    print(f"   ✓ Created {len(interactions_df)} interactions")

    print("\n💾 Saving datasets …")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    students_df.to_csv(DATA_DIR / "students.csv", index=False)
    interactions_df.to_csv(DATA_DIR / "interactions.csv", index=False)
    print(f"   ✓ students.csv  → {DATA_DIR / 'students.csv'}")
    print(f"   ✓ interactions.csv → {DATA_DIR / 'interactions.csv'}")
    print("   ℹ  materials.csv was NOT overwritten (using real REB data)")

    print("\n✅ Data generation complete!")
    print("\nDataset Summary:")
    print(f"   • Students:     {len(students_df)}")
    print(f"   • Materials:    {len(materials_df)}  (real REB CBC units)")
    print(f"   • Interactions: {len(interactions_df)}")
    print(f"   • Subjects:     Mathematics, Physics")
    print(f"   • Grade levels: S1, S2, S3")
    print(f"   • Competencies: {materials_df['competency'].nunique()}")

    print("\n📋 Sample interactions:")
    print(interactions_df.head(3).to_string(index=False))

    return students_df, materials_df, interactions_df


if __name__ == "__main__":
    main()
