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
from backend.routes import auth, students, materials, recommendations, analytics
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

    # Seed the database (idempotent — skips existing records)
    try:
        from backend.seed import run as seed_run
        seed_run()
        logger.info("✅ Database seeded")
    except Exception as exc:
        logger.warning(f"⚠️  Seed skipped or failed: {exc}")

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
    origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

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

    # ── Static files (downloaded REB PDFs) ────────────────────────────────────
    static_dir = Path(__file__).parent / "static" / "materials"
    static_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/static/materials", StaticFiles(directory=str(static_dir)), name="static_materials")

    # ── Health Check ──────────────────────────────────────────────────────────
    @app.get("/", response_model=HealthCheck, tags=["system"])
    async def health_check():
        """Public health-check — confirm API is alive."""
        return HealthCheck(
            message="SmartSoma API is running",
            version="2.0.0",
            status="healthy",
            db_connected=True,
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
