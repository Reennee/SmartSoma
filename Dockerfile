# ─── SmartSoma Backend — Production Dockerfile ───────────────────────────────
# Runs FastAPI on port 8000 (Railway sets $PORT automatically)

FROM python:3.11-slim

WORKDIR /app

# System deps (needed for bcrypt / cryptography compile)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY backend/ ./backend/
COPY data/    ./data/
COPY models/  ./models/

# Expose default port (Railway overrides via $PORT env var)
EXPOSE 8000

# Seed the database, then start the server
CMD ["sh", "-c", "python -m backend.seed && uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
