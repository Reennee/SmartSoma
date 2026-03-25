"""
Quiz generation route — uses Claude AI to produce 4 multiple-choice
questions tailored to the exact material the student is about to study.

  GET  /api/materials/{material_id}/quiz
       → returns [{"text", "options": [...], "correct": int}, ...]

Falls back gracefully when:
  - ANTHROPIC_API_KEY is not set
  - The material has no extracted_text (uses title + description instead)
  - Claude returns malformed JSON
"""

import json
import logging
import os
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Material
from backend.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/materials", tags=["quiz"])


# ── Response schema ───────────────────────────────────────────────────────────

class QuizQuestion(BaseModel):
    text: str
    options: list[str]
    correct: int


# ── Helpers ───────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """You are an educational assessment expert designing comprehension
questions for Rwandan secondary students following the Competency-Based Curriculum (CBC).
Your questions should test genuine understanding, not just rote recall.
Always respond with a valid JSON array — no markdown fences, no extra text."""


def _build_user_prompt(mat: Material) -> str:
    difficulty = mat.difficulty_level or "Intermediate"
    subject    = mat.subject or "Science"

    if mat.extracted_text:
        content_section = (
            f"Material content (excerpt):\n{mat.extracted_text[:4500]}"
        )
    else:
        content_section = (
            f"Material title: {mat.title}\n"
            f"Description: {mat.description or 'No description available.'}"
        )

    return f"""Generate exactly 4 multiple-choice comprehension questions for the following
{subject} study material at {difficulty} level.

{content_section}

Return ONLY a JSON array of 4 objects. No markdown, no explanation. Format:
[
  {{
    "text": "<question>",
    "options": ["<A>", "<B>", "<C>", "<D>"],
    "correct": <0-3 index of correct option>
  }},
  ...
]

Requirements:
- Each question must have exactly 4 options.
- "correct" is the 0-based index of the correct answer.
- Questions should be clear, unambiguous, and appropriate for CBC S1-S3 students.
- Distractors should be plausible but clearly wrong to a student who understood the material."""


def _parse_questions(raw: str) -> list[QuizQuestion]:
    """Extract JSON array from Claude's response, validate shape."""
    # Strip accidental markdown code fences
    raw = re.sub(r"```(?:json)?", "", raw).strip()

    # Find the first '[' ... ']' block
    start = raw.find("[")
    end   = raw.rfind("]")
    if start == -1 or end == -1:
        raise ValueError("No JSON array found in response")

    data = json.loads(raw[start : end + 1])

    questions: list[QuizQuestion] = []
    for item in data:
        q = QuizQuestion(
            text=str(item["text"]),
            options=[str(o) for o in item["options"][:4]],
            correct=int(item["correct"]),
        )
        if len(q.options) != 4 or q.correct not in range(4):
            continue
        questions.append(q)

    if not questions:
        raise ValueError("No valid questions parsed")

    return questions[:4]


# ── Route ─────────────────────────────────────────────────────────────────────

@router.get("/{material_id}/quiz", response_model=list[QuizQuestion])
async def generate_quiz(
    material_id: int,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
):
    """
    Generate 4 AI-powered comprehension questions for a material.
    Uses the material's extracted text when available; falls back to
    title + description. Requires ANTHROPIC_API_KEY env var.
    """
    mat = db.query(Material).filter(Material.material_id == material_id).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI quiz generation is not configured (missing API key).",
        )

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": _build_user_prompt(mat)}],
        )
        raw_text = message.content[0].text
        questions = _parse_questions(raw_text)
        logger.info(
            f"✅ Generated {len(questions)} quiz questions for material {material_id}"
        )
        return questions

    except Exception as exc:
        logger.warning(f"⚠️  Quiz generation failed for material {material_id}: {exc}")
        raise HTTPException(
            status_code=502,
            detail=f"Quiz generation failed: {str(exc)}",
        )
