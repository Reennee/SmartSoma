"""
SmartSoma — Material PDF Downloader
====================================
Downloads every PDF listed in materials.csv from its file_url and saves it
to the local backend/static/materials/ directory so the study modal can
serve it directly (no internet required for students).

After downloading, updates the materials table in the DB:
  file_path is already populated in the CSV; this script just confirms the
  file is actually present on disk. It also updates file_url in the DB to
  point to the local static path  (/static/materials/…) so the recommender
  returns the local URL and the study modal loads the PDF from the backend.

Usage:
  cd /path/to/SmartSoma
  python -m backend.scripts.download_materials

  Optional flags:
    --dry-run    Print what would be downloaded, don't save anything
    --force      Re-download even if the local file already exists
"""

import argparse
import os
import sys
import time
from pathlib import Path

import requests

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent
DATA_CSV    = BACKEND_DIR / "data" / "materials.csv"
STATIC_ROOT = BACKEND_DIR / "static" / "materials"   # FastAPI serves this at /static/materials

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; SmartSomaBot/1.0; "
        "+https://smartsoma.app)"
    )
}


def download(url: str, dest: Path, force: bool) -> bool:
    """Download url → dest.  Returns True on success."""
    if dest.exists() and not force:
        print(f"   ↩  Already exists: {dest.name}")
        return True

    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20, stream=True)
        resp.raise_for_status()
        ct = resp.headers.get("content-type", "")
        if "html" in ct and "pdf" not in ct:
            print(f"   ⚠  Skipped (HTML response, not a PDF): {url}")
            return False
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(chunk_size=65536):
                f.write(chunk)
        size_kb = dest.stat().st_size // 1024
        print(f"   ✓  {dest.name}  ({size_kb} KB)")
        return True
    except Exception as exc:
        print(f"   ✗  FAILED {url}: {exc}")
        return False


def update_db(material_id: int, local_path: str) -> None:
    """Update file_url in the DB to the local static path so recommender uses it."""
    try:
        # Only import DB stuff when we actually need it
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
    parser = argparse.ArgumentParser(description="Download REB PDF materials")
    parser.add_argument("--dry-run", action="store_true", help="Print only, don't download")
    parser.add_argument("--force",   action="store_true", help="Re-download existing files")
    args = parser.parse_args()

    # Load the CSV
    try:
        import pandas as pd
        df = pd.read_csv(DATA_CSV)
    except ImportError:
        # Fallback: simple CSV reader
        import csv
        with open(DATA_CSV, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        # Convert to list of dicts
        df = rows  # type: ignore[assignment]
        use_pandas = False
    else:
        use_pandas = True

    rows = df.to_dict("records") if use_pandas else df  # type: ignore[union-attr]

    ok = 0
    failed = 0
    skipped = 0

    print(f"\n📥 SmartSoma Material Downloader")
    print(f"   Static root: {STATIC_ROOT}")
    print(f"   Dry run:     {args.dry_run}")
    print(f"   Force:       {args.force}")
    print("─" * 60)

    for row in rows:
        mid      = int(row["material_id"])
        title    = str(row["title"])[:60]
        file_url = str(row.get("file_url") or "").strip()
        file_path = str(row.get("file_path") or "").strip()

        if not file_url or file_url.lower() == "nan":
            print(f"\n[{mid:>3}] {title}")
            print(f"   —  No file_url, skipping.")
            skipped += 1
            continue

        # Convert file_path (/static/materials/math/s1/foo.pdf) to local disk path
        # Strip the leading /static/materials/ prefix → math/s1/foo.pdf
        if file_path.startswith("/static/materials/"):
            rel = file_path[len("/static/materials/"):]
        elif file_path:
            rel = file_path.lstrip("/")
        else:
            # Derive from URL filename
            rel = Path(file_url).name

        dest = STATIC_ROOT / rel

        print(f"\n[{mid:>3}] {title}")
        print(f"   src : {file_url}")
        print(f"   dest: {dest}")

        if args.dry_run:
            skipped += 1
            continue

        success = download(file_url, dest, args.force)
        if success:
            ok += 1
            # Update file_path in DB to the static path
            update_db(mid, f"/static/materials/{rel}")
            time.sleep(0.3)   # polite crawl delay
        else:
            failed += 1

    print("\n" + "─" * 60)
    print(f"✅ Downloaded: {ok}   ✗ Failed: {failed}   ↩ Skipped: {skipped}")
    if failed > 0:
        print("   Tip: REB URLs may require a VPN or have changed.")
        print("   You can manually place PDFs in backend/static/materials/ using")
        print("   the same subdirectory structure as file_path in materials.csv.")


if __name__ == "__main__":
    # Allow running from project root without installing the package
    sys.path.insert(0, str(BACKEND_DIR.parent))
    main()
