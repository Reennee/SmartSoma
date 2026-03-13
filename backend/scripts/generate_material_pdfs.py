"""
SmartSoma — Local Material PDF Generator
==========================================
The REB e-learning portal (elearning.reb.rw) requires institutional access
and the public-facing PDF URLs are not directly accessible.

This script generates a self-contained study PDF for each of the 60 CBC
materials using the title, description, subject, grade and competency data
already stored in materials.csv.  The PDFs are saved in
backend/static/materials/{subject}/{grade}/ and the file_path column in the
materials table is updated so the study modal loads them from the backend.

Usage:
    cd /path/to/SmartSoma
    pip install fpdf2 pandas
    python -m backend.scripts.generate_material_pdfs

    Optional:
      --force   Regenerate PDFs even if they already exist
"""

import argparse
import csv
import sys
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent
DATA_CSV    = BACKEND_DIR / "data" / "materials.csv"
STATIC_ROOT = BACKEND_DIR / "static" / "materials"

# Subject → accent colour (R, G, B)
SUBJECT_COLOURS = {
    "Mathematics": (59, 130, 246),    # blue
    "Physics":     (139, 92, 246),    # purple
}
DEFAULT_COLOUR = (100, 116, 139)


def wrap_text(text: str, max_chars: int) -> list[str]:
    """Simple word-wrap."""
    words = text.split()
    lines, current = [], ""
    for word in words:
        if len(current) + len(word) + 1 <= max_chars:
            current = (current + " " + word).strip()
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def make_pdf(row: dict, dest: Path) -> None:
    """Generate a study-ready PDF for one material row."""
    from fpdf import FPDF

    subject    = str(row.get("subject", ""))
    title      = str(row.get("title", "Untitled"))
    competency = str(row.get("competency", ""))
    grade      = str(row.get("grade_level", ""))
    difficulty = str(row.get("difficulty", ""))
    duration   = str(row.get("duration_minutes", ""))
    description = str(row.get("description", ""))
    mid         = str(row.get("material_id", ""))

    r, g, b = SUBJECT_COLOURS.get(subject, DEFAULT_COLOUR)

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()
    pdf.set_margins(20, 20, 20)

    # ── Header band ──
    pdf.set_fill_color(r, g, b)
    pdf.rect(0, 0, 210, 42, "F")

    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_xy(20, 8)
    pdf.cell(0, 7, f"SmartSoma  ·  {subject}  ·  Grade {grade}", ln=True)

    pdf.set_font("Helvetica", "B", 16)
    # Wrap title if needed
    title_lines = wrap_text(title, 55)
    pdf.set_xy(20, 18)
    for line in title_lines[:2]:
        pdf.cell(0, 8, line, ln=True)

    # ── Metadata chips ──
    pdf.set_text_color(80, 80, 80)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_xy(20, 48)
    meta = f"Competency: {competency}    |    Difficulty: {difficulty}    |    Duration: {duration} min    |    Material #{mid}"
    pdf.cell(0, 6, meta, ln=True)

    pdf.set_draw_color(200, 200, 200)
    pdf.line(20, 58, 190, 58)

    # ── Description ──
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(30, 30, 30)
    pdf.set_xy(20, 64)
    pdf.cell(0, 8, "Learning Overview", ln=True)

    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(60, 60, 60)
    pdf.set_xy(20, 75)
    desc_lines = wrap_text(description or "No description available.", 80)
    for line in desc_lines:
        pdf.cell(0, 6, line, ln=True)

    # ── Learning objectives placeholder ──
    y = pdf.get_y() + 10
    pdf.set_xy(20, y)
    pdf.set_fill_color(245, 247, 250)
    pdf.set_draw_color(200, 210, 230)
    pdf.rect(20, y, 170, 80, "FD")

    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(r, g, b)
    pdf.set_xy(26, y + 6)
    pdf.cell(0, 7, "Learning Objectives", ln=True)

    objectives = [
        f"Understand the core concepts of {competency}.",
        "Apply learned techniques to solve related problems.",
        "Connect this topic to real-world Rwandan contexts.",
        f"Build mastery toward {subject} Grade {grade} proficiency.",
        "Prepare for competency assessments and national exams.",
    ]
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(50, 50, 70)
    for obj in objectives:
        pdf.set_x(26)
        pdf.cell(4, 6, chr(149), ln=False)   # bullet
        pdf.cell(0, 6, obj, ln=True)

    # ── Study notes area ──
    y2 = pdf.get_y() + 12
    pdf.set_xy(20, y2)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 7, "Study Notes", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(120, 120, 120)
    pdf.set_xy(20, pdf.get_y() + 2)
    pdf.cell(0, 6, "Use this space to write key concepts, formulas, and worked examples.", ln=True)

    # Draw ruled lines for note-taking
    start_y = pdf.get_y() + 6
    for i in range(12):
        line_y = start_y + i * 10
        if line_y > 270:
            break
        pdf.set_draw_color(210, 215, 220)
        pdf.line(20, line_y, 190, line_y)

    # ── Footer ──
    pdf.set_y(-18)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(160, 160, 160)
    pdf.cell(0, 6,
        f"SmartSoma AI-powered learning  ·  {subject} {grade}  ·  {competency}  ·  Page 1",
        align="C"
    )

    dest.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(dest))


def update_db(material_id: int, local_path: str) -> None:
    """Update file_path in the DB to the local static path."""
    try:
        from backend.database import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(
                text("UPDATE materials SET file_path = :fp WHERE material_id = :mid"),
                {"fp": local_path, "mid": material_id},
            )
            conn.commit()
    except Exception as exc:
        print(f"      ⚠  DB update skipped for material {material_id}: {exc}")


def main():
    parser = argparse.ArgumentParser(description="Generate local study PDFs for all materials")
    parser.add_argument("--force", action="store_true", help="Regenerate even if file exists")
    args = parser.parse_args()

    with open(DATA_CSV, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    ok = skipped = 0

    print(f"\n📄 SmartSoma PDF Generator  ({len(rows)} materials)")
    print(f"   Output: {STATIC_ROOT}")
    print("─" * 60)

    for row in rows:
        mid        = int(row["material_id"])
        title      = row["title"][:55]
        file_path  = str(row.get("file_path") or "").strip()
        subject    = str(row.get("subject", "")).lower().replace(" ", "")
        grade      = str(row.get("grade_level", "")).lower()

        # Derive local dest from file_path column (already has the right relative path)
        if file_path.startswith("/static/materials/"):
            rel = file_path[len("/static/materials/"):]
        elif file_path:
            rel = file_path.lstrip("/")
        else:
            # Fallback: subject/grade/material-{id}.pdf
            rel = f"{subject}/{grade}/material-{mid}.pdf"

        dest = STATIC_ROOT / rel

        if dest.exists() and not args.force:
            print(f"[{mid:>3}] ↩  {title}")
            skipped += 1
            continue

        print(f"[{mid:>3}] ✎  {title}")
        try:
            make_pdf(row, dest)
            local_static_path = f"/static/materials/{rel}"
            update_db(mid, local_static_path)
            ok += 1
        except Exception as exc:
            print(f"      ✗  Error: {exc}")

    print("\n" + "─" * 60)
    print(f"✅ Generated: {ok}   ↩ Skipped (already exist): {skipped}")
    print(f"\nPDFs are served at:  GET {{BACKEND_URL}}/static/materials/...")
    print("The study modal will now load them in the embedded viewer.")


if __name__ == "__main__":
    sys.path.insert(0, str(BACKEND_DIR.parent))
    main()
