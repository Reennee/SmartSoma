"""
SmartSoma API — App Factory
Registers all routers, configures CORS, creates DB tables on startup,
loads the BiLSTM DKT model, and wires up the health-check endpoint.
"""

import os
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

from backend.database import engine, Base
from backend.routes import auth, students, materials, recommendations, analytics, quiz
from backend.services.dkt import DKTService
from backend.schemas import HealthCheck

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Startup / Shutdown ───────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all database tables (idempotent)
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables ready")

    # Apply any missing column migrations — each statement is independent so
    # one failure (e.g. column already exists) does not block the rest.
    from sqlalchemy import text

    _alter_statements = [
        "ALTER TABLE materials ADD COLUMN description TEXT",
        "ALTER TABLE materials ADD COLUMN file_url VARCHAR(500)",
        "ALTER TABLE users ADD COLUMN school_id VARCHAR(50)",
        "ALTER TABLE materials ADD COLUMN extracted_text TEXT",
        "ALTER TABLE materials ADD COLUMN extraction_status VARCHAR(20)",
        "ALTER TABLE materials ADD COLUMN published_at TIMESTAMP",
        # cbc_competencies.subject was added to the model but never migrated
        "ALTER TABLE cbc_competencies ADD COLUMN subject VARCHAR(100)",
        "ALTER TABLE materials ADD COLUMN extraction_error TEXT",
        "ALTER TABLE users ADD COLUMN school_fk INTEGER REFERENCES schools(school_id)",
    ]

    # Backfill subject on existing competency rows that have NULL subject
    # by joining to the materials table which already stores subject.
    _backfill_sql = """
        UPDATE cbc_competencies
        SET subject = (
            SELECT m.subject FROM materials m
            WHERE m.competency_id = cbc_competencies.competency_id
            LIMIT 1
        )
        WHERE subject IS NULL
    """

    with engine.connect() as conn:
        for stmt in _alter_statements:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                conn.rollback()  # column already exists — skip silently

        # Backfill subject column for competency rows that pre-date the migration
        try:
            conn.execute(text(_backfill_sql))
            conn.commit()
        except Exception:
            conn.rollback()

        # CREATE TABLE is idempotent via IF NOT EXISTS — safe in one shot
        try:
            conn.execute(text(
                """CREATE TABLE IF NOT EXISTS schools (
                    school_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(200) NOT NULL UNIQUE
                )"""
            ))
            conn.commit()
        except Exception as exc:
            logger.warning(f"⚠️  schools table: {exc}")

        try:
            conn.execute(text(
                """CREATE TABLE IF NOT EXISTS student_warnings (
                    warning_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL REFERENCES users(user_id),
                    message TEXT NOT NULL,
                    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_read BOOLEAN DEFAULT 0
                )"""
            ))
            conn.commit()
        except Exception as exc:
            logger.warning(f"⚠️  student_warnings table: {exc}")

        try:
            conn.execute(text(
                """CREATE TABLE IF NOT EXISTS student_topic_grades (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL REFERENCES users(user_id),
                    subject VARCHAR(100) NOT NULL,
                    topic VARCHAR(200),
                    competency_id INTEGER REFERENCES cbc_competencies(competency_id),
                    grade FLOAT NOT NULL,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )"""
            ))
            conn.commit()
        except Exception as exc:
            logger.warning(f"⚠️  student_topic_grades table: {exc}")

    logger.info("✅ DB schema up to date")

    # Seed the database (dev-only unless explicitly enabled)
    env = os.getenv("ENV", "development").lower()
    seed_on_startup = os.getenv("SEED_ON_STARTUP", "").lower() in ("1", "true", "yes")
    if env in ("dev", "development") or seed_on_startup:
        try:
            from backend.seed import run as seed_run
            seed_run()
            logger.info("✅ Database seeded")
        except Exception as exc:
            logger.warning(f"⚠️  Seed skipped or failed: {exc}")
    else:
        logger.info("ℹ️  Seeding disabled (set SEED_ON_STARTUP=true to enable)")

    # Load the BiLSTM DKT model into memory
    DKTService.load()
    model_status = "loaded" if DKTService._model is not None else "heuristic fallback"
    logger.info(f"✅ DKT model: {model_status}")

    yield  # application runs here

    logger.info("SmartSoma API shutting down")


# ─── App Factory ─────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(
        title="SmartSoma API",
        description=(
            "AI-powered, offline-first study material recommender "
            "for Rwandan secondary students. "
            "Built on FastAPI + BiLSTM Deep Knowledge Tracing."
        ),
        version="2.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ── CORS ─────────────────────────────────────────────────────────────────
    raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    # Strip whitespace AND trailing slashes — browsers send origins without trailing slash
    origins = [o.strip().rstrip("/") for o in raw_origins.split(",") if o.strip()]
    logger.info(f"✅ CORS origins: {origins}")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(auth.router)
    app.include_router(students.router)
    app.include_router(materials.router)
    app.include_router(recommendations.router)
    app.include_router(analytics.router)
    app.include_router(quiz.router)

    # ── Static files (downloaded REB PDFs) ────────────────────────────────────
    static_dir = Path(__file__).parent / "static" / "materials"
    static_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/static/materials", StaticFiles(directory=str(static_dir)), name="static_materials")

    # ── Health Check ──────────────────────────────────────────────────────────
    @app.get("/", response_model=HealthCheck, tags=["system"])
    async def health_check():
        """Public health-check — confirm API is alive."""
        from sqlalchemy import text
        db_ok = False
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            db_ok = True
        except Exception:
            db_ok = False
        return HealthCheck(
            message="SmartSoma API is running",
            version="2.0.0",
            status="healthy",
            db_connected=db_ok,
            model_loaded=DKTService._model is not None,
        )

    return app


app = create_app()

# ─── Dev entry point ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
