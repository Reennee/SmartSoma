"""
SmartSoma API Test Suite
========================
Covers all major endpoints under different scenarios:
  - Authentication (register, login, /me, edge cases)
  - Materials (list, filter, detail, competencies)
  - Recommendations (student flow, teacher access control)
  - Analytics (teacher-only access, school scoping)
  - Students (progress, subject grades, test upload)

Run with:
    pytest backend/tests/test_api.py -v
"""

import os

# ── Set env vars BEFORE any backend imports ───────────────────────────────────
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ.setdefault("SECRET_KEY", "test-secret-key-only-used-in-ci")
os.environ["ANTHROPIC_API_KEY"] = ""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# ── Shared in-memory engine (StaticPool = same connection for all sessions) ──
TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TEST_SESSION = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)

# ── Patch backend.database before the app module loads ───────────────────────
import backend.database as _db_module
_db_module.engine = TEST_ENGINE
_db_module.SessionLocal = TEST_SESSION

from backend.main import app                        # noqa: E402
from backend.database import Base, get_db           # noqa: E402
from backend.models import CBCCompetency, Material  # noqa: E402


def override_get_db():
    db = TEST_SESSION()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


# ─────────────────────────────────────────────────────────────────────────────
# Session-level fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def seed_db():
    Base.metadata.create_all(bind=TEST_ENGINE)
    db = TEST_SESSION()
    try:
        comp_math = CBCCompetency(
            competency_name="Algebra and Equations",
            subject="Mathematics",
            grade_level="S1",
            description="Linear and quadratic equations",
        )
        comp_phys = CBCCompetency(
            competency_name="Forces and Motion",
            subject="Physics",
            grade_level="S2",
            description="Newton's laws of motion",
        )
        db.add_all([comp_math, comp_phys])
        db.commit()
        db.refresh(comp_math)
        db.refresh(comp_phys)

        db.add_all([
            Material(
                title="Introduction to Algebra",
                subject="Mathematics",
                competency_id=comp_math.competency_id,
                difficulty_level="Beginner",
                content_type="PDF",
                duration_minutes=30,
                file_url="https://elearning.reb.rw/assets/pdfs/math/s1/algebra-intro.pdf",
                description="Covers variables, expressions and simple equations.",
                extraction_status="pending",
            ),
            Material(
                title="Newton's Laws Explained",
                subject="Physics",
                competency_id=comp_phys.competency_id,
                difficulty_level="Intermediate",
                content_type="Video",
                duration_minutes=20,
                file_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                description="Visual walkthrough of all three Newton's laws.",
                extraction_status="pending",
            ),
        ])
        db.commit()
    finally:
        db.close()
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture(scope="session")
def client(seed_db):
    with TestClient(app) as c:
        yield c


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def register_and_login(client, email, password, full_name, role,
                       grade_level=None, school_id=None):
    payload = {"full_name": full_name, "email": email,
               "password": password, "role": role}
    if grade_level:
        payload["grade_level"] = grade_level
    if school_id:
        # API schema uses school_name (a display name / tenant marker)
        payload["school_name"] = school_id
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 201, f"Register failed ({r.status_code}): {r.text}"
    d = r.json()
    return d["access_token"], d["user_id"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ─────────────────────────────────────────────────────────────────────────────
# Class-scoped tokens  (one registration per class, shared across all methods)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="class")
def materials_token(client):
    token, _ = register_and_login(
        client, "dave@school.rw", "DavePass1!",
        "Dave Habimana", "student", grade_level="S1",
    )
    return token


@pytest.fixture(scope="class")
def rec_student_token(client):
    token, _ = register_and_login(
        client, "student_rec@school.rw", "RecPass1!",
        "Rec Student", "student", grade_level="S1", school_id="GS-KIGALI-002",
    )
    return token


@pytest.fixture(scope="class")
def analytics_tokens(client):
    student_token, _ = register_and_login(
        client, "student_ana@school.rw", "AnaPass1!",
        "Ana Student", "student", grade_level="S2", school_id="GS-HUYE-001",
    )
    teacher_token, _ = register_and_login(
        client, "teacher_ana@school.rw", "TeacherAna1!",
        "Ana Teacher", "teacher", school_id="GS-HUYE-001",
    )
    other_teacher_token, _ = register_and_login(
        client, "other_teacher@school.rw", "OtherTeacher1!",
        "Other Teacher", "teacher", school_id="GS-MUSANZE-999",
    )
    return student_token, teacher_token, other_teacher_token


@pytest.fixture(scope="class")
def progress_token(client):
    token, _ = register_and_login(
        client, "progress_student@school.rw", "ProgPass1!",
        "Progress Student", "student", grade_level="S1",
    )
    return token


@pytest.fixture(scope="class")
def upload_tokens(client):
    teacher_token, _ = register_and_login(
        client, "upload_teacher@school.rw", "UploadTeacher1!",
        "Upload Teacher", "teacher",
    )
    student_token, _ = register_and_login(
        client, "upload_student@school.rw", "UploadStudent1!",
        "Upload Student", "student", grade_level="S1",
    )
    return teacher_token, student_token


# ─────────────────────────────────────────────────────────────────────────────
# 1. AUTHENTICATION
# ─────────────────────────────────────────────────────────────────────────────

class TestAuth:

    def test_register_student_success(self, client):
        token, uid = register_and_login(
            client, "alice@school.rw", "SecurePass1!",
            "Alice Uwimana", "student", grade_level="S1", school_id="GS-KIGALI-001",
        )
        assert token
        assert uid > 0

    def test_register_teacher_success(self, client):
        token, uid = register_and_login(
            client, "teacher_a@school.rw", "TeacherPass1!",
            "Teacher Amina", "teacher", school_id="GS-KIGALI-001",
        )
        assert token
        assert uid > 0

    def test_register_without_school_id(self, client):
        r = client.post("/api/auth/register", json={
            "full_name": "Bob Nkurunziza",
            "email": "bob@school.rw",
            "password": "BobPass123!",
            "role": "student",
            "grade_level": "S2",
        })
        assert r.status_code == 201
        assert r.json()["school_id"] is None

    def test_register_duplicate_email_conflict(self, client):
        r = client.post("/api/auth/register", json={
            "full_name": "Duplicate",
            "email": "alice@school.rw",   # already registered above
            "password": "AnotherPass1!",
            "role": "student",
        })
        assert r.status_code == 409

    def test_register_missing_required_field(self, client):
        r = client.post("/api/auth/register", json={
            "email": "noname@school.rw",
            "password": "Pass123!",
            "role": "student",
        })
        assert r.status_code == 422

    def test_login_valid_credentials(self, client):
        r = client.post("/api/auth/login", json={
            "email": "alice@school.rw",
            "password": "SecurePass1!",
        })
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body
        assert body["role"] == "student"
        assert body["school_id"] == "GS-KIGALI-001"

    def test_login_wrong_password(self, client):
        r = client.post("/api/auth/login", json={
            "email": "alice@school.rw",
            "password": "WrongPassword!",
        })
        assert r.status_code == 401

    def test_login_unknown_email(self, client):
        r = client.post("/api/auth/login", json={
            "email": "nobody@nowhere.rw",
            "password": "Whatever1!",
        })
        assert r.status_code == 401

    def test_me_returns_current_user(self, client):
        token, _ = register_and_login(
            client, "carol@school.rw", "CarolPass1!",
            "Carol Ingabire", "student", grade_level="S3",
        )
        r = client.get("/api/auth/me", headers=auth_headers(token))
        assert r.status_code == 200
        assert r.json()["email"] == "carol@school.rw"

    def test_me_requires_auth(self, client):
        r = client.get("/api/auth/me")
        assert r.status_code in (401, 403)

    def test_me_invalid_token(self, client):
        r = client.get("/api/auth/me",
                       headers={"Authorization": "Bearer invalid.token.here"})
        assert r.status_code in (401, 403)


# ─────────────────────────────────────────────────────────────────────────────
# 2. MATERIALS
# ─────────────────────────────────────────────────────────────────────────────

class TestMaterials:

    def test_list_all_materials(self, client, materials_token):
        r = client.get("/api/materials", headers=auth_headers(materials_token))
        assert r.status_code == 200
        items = r.json().get("items", r.json()) if isinstance(r.json(), dict) else r.json()
        assert len(items) >= 2

    def test_materials_order_newest_published_first(self, client, materials_token):
        # Create two materials; API should return newest published first.
        # (Creation sets published_at automatically.)
        teacher_token, _ = register_and_login(
            client, "order_teacher@school.rw", "OrderTeacher1!",
            "Order Teacher", "teacher",
        )
        r1 = client.post("/api/materials", json={
            "title": "Ordering A",
            "subject": "Mathematics",
            "competency_id": 1,
            "difficulty_level": "Beginner",
            "content_type": "PDF",
            "duration_minutes": 10,
        }, headers=auth_headers(teacher_token))
        assert r1.status_code in (200, 201)
        r2 = client.post("/api/materials", json={
            "title": "Ordering B",
            "subject": "Mathematics",
            "competency_id": 1,
            "difficulty_level": "Beginner",
            "content_type": "PDF",
            "duration_minutes": 10,
        }, headers=auth_headers(teacher_token))
        assert r2.status_code in (200, 201)

        r = client.get("/api/materials", headers=auth_headers(materials_token))
        assert r.status_code == 200
        items = r.json().get("items", [])
        titles = [m["title"] for m in items[:5]]
        assert "Ordering B" in titles and "Ordering A" in titles
        assert titles.index("Ordering B") < titles.index("Ordering A")

    def test_filter_by_subject_math(self, client, materials_token):
        r = client.get("/api/materials?subject=Mathematics",
                       headers=auth_headers(materials_token))
        assert r.status_code == 200
        items = r.json().get("items", r.json()) if isinstance(r.json(), dict) else r.json()
        assert all(m["subject"] == "Mathematics" for m in items)

    def test_filter_by_subject_physics(self, client, materials_token):
        r = client.get("/api/materials?subject=Physics",
                       headers=auth_headers(materials_token))
        assert r.status_code == 200
        items = r.json().get("items", r.json()) if isinstance(r.json(), dict) else r.json()
        assert all(m["subject"] == "Physics" for m in items)

    def test_filter_by_grade_s1(self, client, materials_token):
        r = client.get("/api/materials?grade=S1",
                       headers=auth_headers(materials_token))
        assert r.status_code == 200

    def test_filter_nonexistent_subject_returns_empty(self, client, materials_token):
        r = client.get("/api/materials?subject=Chemistry",
                       headers=auth_headers(materials_token))
        assert r.status_code == 200
        items = r.json().get("items", r.json()) if isinstance(r.json(), dict) else r.json()
        assert len(items) == 0

    def test_material_detail(self, client, materials_token):
        r = client.get("/api/materials", headers=auth_headers(materials_token))
        items = r.json().get("items", r.json()) if isinstance(r.json(), dict) else r.json()
        mid = items[0]["material_id"]
        r2 = client.get(f"/api/materials/{mid}", headers=auth_headers(materials_token))
        assert r2.status_code == 200
        assert r2.json()["material_id"] == mid

    def test_material_detail_not_found(self, client, materials_token):
        r = client.get("/api/materials/99999", headers=auth_headers(materials_token))
        assert r.status_code == 404

    def test_competencies_list(self, client, materials_token):
        r = client.get("/api/materials/competencies",
                       headers=auth_headers(materials_token))
        assert r.status_code == 200
        assert len(r.json()) >= 2

    def test_materials_requires_auth(self, client):
        r = client.get("/api/materials")
        assert r.status_code in (401, 403)


# ─────────────────────────────────────────────────────────────────────────────
# 3. RECOMMENDATIONS
# ─────────────────────────────────────────────────────────────────────────────

class TestRecommendations:

    def test_student_gets_recommendations(self, client, rec_student_token):
        r = client.post("/api/recommend", json={"limit": 5},
                        headers=auth_headers(rec_student_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_recommendations_respect_limit(self, client, rec_student_token):
        r = client.post("/api/recommend", json={"limit": 1},
                        headers=auth_headers(rec_student_token))
        assert r.status_code == 200
        assert len(r.json()) <= 1

    def test_recommendations_filter_by_subject(self, client, rec_student_token):
        r = client.post("/api/recommend",
                        json={"limit": 5, "subject": "Mathematics"},
                        headers=auth_headers(rec_student_token))
        assert r.status_code == 200
        for item in r.json():
            assert item["subject"] == "Mathematics"

    def test_recommendations_filter_physics(self, client, rec_student_token):
        r = client.post("/api/recommend",
                        json={"limit": 5, "subject": "Physics"},
                        headers=auth_headers(rec_student_token))
        assert r.status_code == 200
        for item in r.json():
            assert item["subject"] == "Physics"

    def test_recommendations_require_auth(self, client):
        r = client.post("/api/recommend", json={"limit": 5})
        assert r.status_code in (401, 403)

    def test_recommendation_fields_present(self, client, rec_student_token):
        r = client.post("/api/recommend", json={"limit": 3},
                        headers=auth_headers(rec_student_token))
        assert r.status_code == 200
        for item in r.json():
            assert "material_id" in item
            assert "title" in item
            assert "subject" in item
            assert "confidence_score" in item


# ─────────────────────────────────────────────────────────────────────────────
# 4. ANALYTICS (teacher-only)
# ─────────────────────────────────────────────────────────────────────────────

class TestAnalytics:

    def test_teacher_can_access_class_analytics(self, client, analytics_tokens):
        _, teacher_token, _ = analytics_tokens
        r = client.get("/api/analytics/class", headers=auth_headers(teacher_token))
        assert r.status_code == 200

    def test_student_cannot_access_analytics(self, client, analytics_tokens):
        student_token, _, _ = analytics_tokens
        r = client.get("/api/analytics/class", headers=auth_headers(student_token))
        assert r.status_code == 403

    def test_analytics_requires_auth(self, client):
        r = client.get("/api/analytics/class")
        assert r.status_code in (401, 403)

    def test_school_scoping_different_school_sees_own_students(
            self, client, analytics_tokens):
        """Teacher from MUSANZE-999 should not see HUYE-001 students."""
        _, _, other_teacher_token = analytics_tokens
        r = client.get("/api/analytics/class",
                       headers=auth_headers(other_teacher_token))
        assert r.status_code == 200
        body = r.json()
        students = body.get("students", body.get("student_summaries", []))
        assert not any(s.get("school_id") == "GS-HUYE-001" for s in students)

    def test_at_risk_endpoint(self, client, analytics_tokens):
        _, teacher_token, _ = analytics_tokens
        r = client.get("/api/analytics/at-risk",
                       headers=auth_headers(teacher_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_stats_endpoint_is_public(self, client):
        r = client.get("/api/analytics/stats")
        assert r.status_code == 200

    def test_teacher_can_warn_student_in_other_school(self, client):
        # Current behavior: warnings are not school-scoped (future enhancement).
        teacher_token, _ = register_and_login(
            client, "warn_teacher@a.rw", "WarnTeacher1!",
            "Warn Teacher", "teacher", school_id="SchoolA"
        )
        _, student_id = register_and_login(
            client, "warn_student@b.rw", "WarnStudent1!",
            "Warn Student", "student", grade_level="S1", school_id="SchoolB"
        )
        r = client.post(
            f"/api/analytics/warn/{student_id}",
            json={"message": "Test"},
            headers=auth_headers(teacher_token),
        )
        assert r.status_code in (200, 201)


# ─────────────────────────────────────────────────────────────────────────────
# 5. STUDENT PROGRESS & GRADES
# ─────────────────────────────────────────────────────────────────────────────

class TestStudentProgress:

    def test_progress_endpoint_returns_data(self, client, progress_token):
        r = client.get("/api/students/me/progress",
                       headers=auth_headers(progress_token))
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

    def test_upload_subject_grades_math_low(self, client, progress_token):
        """Low grade (35%) should be stored without error."""
        r = client.post("/api/students/me/subject-grades",
                        json={"grades": [{"subject": "Mathematics", "grade": 35.0}]},
                        headers=auth_headers(progress_token))
        assert r.status_code == 200

    def test_upload_subject_grades_physics_high(self, client, progress_token):
        """High grade (92%) should be stored correctly."""
        r = client.post("/api/students/me/subject-grades",
                        json={"grades": [{"subject": "Physics", "grade": 92.0}]},
                        headers=auth_headers(progress_token))
        assert r.status_code == 200

    def test_upload_multiple_subject_grades(self, client, progress_token):
        r = client.post("/api/students/me/subject-grades",
                        json={"grades": [
                            {"subject": "Mathematics", "grade": 55.0},
                            {"subject": "Physics", "grade": 70.0},
                        ]},
                        headers=auth_headers(progress_token))
        assert r.status_code == 200

    def test_get_subject_grades(self, client, progress_token):
        r = client.get("/api/students/me/subject-grades",
                       headers=auth_headers(progress_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_upload_topic_grades_by_competency_and_text(self, client, progress_token):
        # By competency id
        r1 = client.post(
            "/api/students/me/topic-grades",
            json={"grades": [{"subject": "Mathematics", "grade": 35.0, "competency_id": 1}]},
            headers=auth_headers(progress_token),
        )
        assert r1.status_code == 200
        body1 = r1.json()
        assert body1["saved"] == 1

        # By free-text topic
        r2 = client.post(
            "/api/students/me/topic-grades",
            json={"grades": [{"subject": "Mathematics", "grade": 40.0, "topic": "Integers"}]},
            headers=auth_headers(progress_token),
        )
        assert r2.status_code == 200
        body2 = r2.json()
        assert body2["saved"] == 1

        # Can read back
        r3 = client.get("/api/students/me/topic-grades", headers=auth_headers(progress_token))
        assert r3.status_code == 200
        assert isinstance(r3.json(), list)

    def test_upload_test_results(self, client, progress_token):
        r = client.post("/api/students/me/upload-results",
                        json={"results": [
                            {"competency_id": 1, "score": 0.45},
                            {"competency_id": 2, "score": 0.85},
                        ]},
                        headers=auth_headers(progress_token))
        assert r.status_code in (200, 422)

    def test_log_material_interaction(self, client, progress_token):
        r_mats = client.get("/api/materials",
                            headers=auth_headers(progress_token))
        items = r_mats.json()
        if isinstance(items, dict):
            items = items.get("items", [])
        if not items:
            pytest.skip("No materials in DB")
        mid = items[0]["material_id"]
        r = client.post(f"/api/materials/{mid}/interact",
                        json={"material_id": mid,
                              "time_spent_seconds": 300, "quiz_score": 80},
                        headers=auth_headers(progress_token))
        assert r.status_code == 200

    def test_progress_requires_auth(self, client):
        r = client.get("/api/students/me/progress")
        assert r.status_code in (401, 403)

    def test_teacher_cannot_view_progress_for_student_in_other_school(self, client):
        # Teacher in SchoolA
        teacher_token, _ = register_and_login(
            client, "scope_teacher@a.rw", "ScopeTeacher1!",
            "Scope Teacher", "teacher", school_id="SchoolA"
        )
        # Student in SchoolB
        _, student_id = register_and_login(
            client, "scope_student@b.rw", "ScopeStudent1!",
            "Scope Student", "student", grade_level="S1", school_id="SchoolB"
        )

        r = client.get(
            f"/api/students/{student_id}/progress",
            headers=auth_headers(teacher_token),
        )
        assert r.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# 6. TEACHER MATERIAL UPLOAD
# ─────────────────────────────────────────────────────────────────────────────

class TestTeacherUpload:

    def test_teacher_can_add_material(self, client, upload_tokens):
        teacher_token, _ = upload_tokens
        r = client.post("/api/materials", json={
            "title": "Teacher Uploaded: Quadratic Formula",
            "subject": "Mathematics",
            "competency_id": 1,
            "difficulty_level": "Intermediate",
            "content_type": "PDF",
            "duration_minutes": 25,
            "file_url": "https://elearning.reb.rw/assets/pdfs/math/s2/quadratic.pdf",
            "description": "Step-by-step derivation of the quadratic formula.",
        }, headers=auth_headers(teacher_token))
        assert r.status_code in (200, 201)

    def test_teacher_can_add_youtube_material(self, client, upload_tokens):
        teacher_token, _ = upload_tokens
        r = client.post("/api/materials", json={
            "title": "Physics: Forces Explained",
            "subject": "Physics",
            "competency_id": 2,
            "difficulty_level": "Beginner",
            "content_type": "Video",
            "duration_minutes": 12,
            "file_url": "https://www.youtube.com/watch?v=example123",
            "description": "YouTube video explaining Newton's laws visually.",
        }, headers=auth_headers(teacher_token))
        assert r.status_code in (200, 201)

    def test_student_cannot_add_material(self, client, upload_tokens):
        _, student_token = upload_tokens
        r = client.post("/api/materials", json={
            "title": "Student uploaded (should fail)",
            "subject": "Mathematics",
            "competency_id": 1,
            "difficulty_level": "Beginner",
            "content_type": "PDF",
            "duration_minutes": 10,
        }, headers=auth_headers(student_token))
        assert r.status_code == 403
