"""
URL Content Extractor + Claude AI Metadata Extractor
Supports YouTube, PDF, and general web pages.
"""

import io
import json
import logging
import os
import re
import socket
import ipaddress
from html.parser import HTMLParser
from typing import Optional
from urllib.parse import urlparse, urljoin

import requests
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# ── SSRF / URL safety helpers ─────────────────────────────────────────────────

_MAX_REDIRECTS = 3
_DEFAULT_TIMEOUT = 8
_MAX_FETCH_BYTES = 25 * 1024 * 1024  # 25MB hard cap for downloads


def _is_private_host(hostname: str) -> bool:
    """
    Resolve hostname and reject localhost/private/link-local/reserved IPs.
    Best-effort: if DNS fails, treat as unsafe for preview/extraction.
    """
    try:
        infos = socket.getaddrinfo(hostname, None)
    except Exception:
        return True
    for info in infos:
        ip_str = info[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            return True
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            return True
    return False


def _validate_external_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Only http/https URLs are allowed")
    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="URLs with embedded credentials are not allowed")
    hostname = parsed.hostname or ""
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid URL hostname")
    host_l = hostname.lower()
    if host_l in ("localhost",) or host_l.endswith(".local"):
        raise HTTPException(status_code=400, detail="Localhost URLs are not allowed")
    if _is_private_host(hostname):
        raise HTTPException(status_code=400, detail="Private-network URLs are not allowed")


def _safe_request(method: str, url: str, *, stream: bool = False, timeout: int = _DEFAULT_TIMEOUT):
    """
    Perform an outbound request with redirect handling that validates each hop
    before following (prevents redirect-to-private SSRF).
    """
    _validate_external_url(url)
    current = url
    for _ in range(_MAX_REDIRECTS + 1):
        r = requests.request(
            method,
            current,
            timeout=timeout,
            headers=_HEADERS,
            stream=stream,
            allow_redirects=False,
        )
        if 300 <= r.status_code < 400 and r.headers.get("Location"):
            nxt = urljoin(current, r.headers["Location"])
            r.close()
            _validate_external_url(nxt)
            current = nxt
            continue
        return r
    raise HTTPException(status_code=400, detail="Too many redirects")


def _read_stream_with_cap(resp: requests.Response, *, max_bytes: int = _MAX_FETCH_BYTES) -> bytes:
    total = 0
    chunks: list[bytes] = []
    for chunk in resp.iter_content(chunk_size=65536):
        if not chunk:
            continue
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(status_code=400, detail="Remote file is too large")
        chunks.append(chunk)
    return b"".join(chunks)


# ── Simple HTML text extractor ─────────────────────────────────────────────────

class _TextExtractor(HTMLParser):
    SKIP_TAGS = {"script", "style", "head", "noscript", "nav", "footer", "header"}

    def __init__(self):
        super().__init__()
        self._skip_depth = 0
        self.title: Optional[str] = None
        self.description: Optional[str] = None
        self._in_title = False
        self._chunks: list[str] = []

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag in self.SKIP_TAGS:
            self._skip_depth += 1
        if tag == "title":
            self._in_title = True
        if tag == "meta":
            name = attrs_dict.get("name", "").lower()
            prop = attrs_dict.get("property", "").lower()
            if name in ("description", "og:description") or prop in ("og:description",):
                self.description = attrs_dict.get("content", "")

    def handle_endtag(self, tag):
        if tag in self.SKIP_TAGS:
            self._skip_depth = max(0, self._skip_depth - 1)
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title and not self.title:
            self.title = data.strip()
        if self._skip_depth == 0:
            text = data.strip()
            if text:
                self._chunks.append(text)

    @property
    def body_text(self) -> str:
        return " ".join(self._chunks)


# ── URL content fetcher ────────────────────────────────────────────────────────

_YOUTUBE_RE = re.compile(
    r"(?:youtube\.com/(?:watch\?v=|shorts/)|youtu\.be/)([A-Za-z0-9_-]{11})"
)
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; SmartSomaBot/1.0; "
        "+https://smartsoma.app)"
    )
}


def fetch_url_content(url: str) -> dict:
    """
    Fetch metadata from a URL.  Returns a dict with keys:
      link_type  ("youtube" | "pdf" | "webpage")
      title, description, body_text, url
    Raises HTTPException(400) if the URL cannot be reached.
    """
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname or ""

        # ── YouTube ────────────────────────────────────────────────────────────
        if _YOUTUBE_RE.search(url) or "youtube.com" in hostname or "youtu.be" in hostname:
            oembed_url = f"https://www.youtube.com/oembed?url={url}&format=json"
            r = _safe_request("GET", oembed_url, timeout=_DEFAULT_TIMEOUT)
            r.raise_for_status()
            data = r.json()
            return {
                "link_type": "youtube",
                "title": data.get("title", ""),
                "description": f"Video by {data.get('author_name', 'Unknown')}",
                "body_text": data.get("title", ""),
                "url": url,
            }

        # ── HEAD request to detect PDF ─────────────────────────────────────────
        head = _safe_request("HEAD", url, timeout=_DEFAULT_TIMEOUT)
        ct = head.headers.get("content-type", "").lower()
        if "application/pdf" in ct or url.lower().endswith(".pdf"):
            # Extract filename from URL path as title hint
            path = parsed.path.rstrip("/")
            filename = path.split("/")[-1].replace(".pdf", "").replace("-", " ").replace("_", " ").title()
            return {
                "link_type": "pdf",
                "title": filename,
                "description": "",
                "body_text": f"PDF document: {filename}",
                "url": url,
            }

        # ── General web page ───────────────────────────────────────────────────
        r = _safe_request("GET", url, timeout=_DEFAULT_TIMEOUT)
        r.raise_for_status()
        parser = _TextExtractor()
        parser.feed(r.text[:80_000])   # cap at 80 KB to stay fast
        body = parser.body_text[:1500]

        return {
            "link_type": "webpage",
            "title": parser.title or "",
            "description": parser.description or "",
            "body_text": body,
            "url": url,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("fetch_url_content failed for %s: %s", url, exc)
        raise HTTPException(status_code=400, detail=f"Could not fetch URL: {exc}")


# ── Claude AI metadata extractor ───────────────────────────────────────────────

_SYSTEM_PROMPT = """You are a curriculum metadata extractor for a Rwandan secondary-school learning platform.
Given a web page title, description, and body text, extract structured metadata.
Respond ONLY with a valid JSON object — no markdown, no explanation."""

_VALID_SUBJECTS = ["Mathematics", "Physics"]
_VALID_GRADES = ["S1", "S2", "S3"]
_VALID_DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"]
_VALID_CONTENT_TYPES = ["PDF", "Video", "Article", "Interactive Exercise"]


def extract_metadata(url: str, raw: dict, competencies: list[str]) -> dict:
    """
    Call Claude Haiku to extract structured metadata from fetched URL content.
    Returns a dict ready to be serialised as MaterialPreviewResponse.
    Fields Claude cannot determine are set to None.
    Raises HTTPException(503) if ANTHROPIC_API_KEY is missing.
    Raises HTTPException(502) if the Claude call fails.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI extraction not configured — set ANTHROPIC_API_KEY in .env",
        )

    competency_list = "\n".join(f"  - {c}" for c in competencies)

    user_message = f"""Extract metadata for this learning resource:

URL: {raw['url']}
Link type: {raw['link_type']}
Title: {raw['title']}
Description: {raw['description']}
Body text (first 1500 chars): {raw['body_text']}

Valid subjects: {_VALID_SUBJECTS}
Valid grade levels: {_VALID_GRADES}
Valid difficulty levels: {_VALID_DIFFICULTIES}
Valid content types: {_VALID_CONTENT_TYPES}

Valid competency names (pick the closest match or null):
{competency_list}

Return JSON with exactly these keys (use null for unknown fields):
{{
  "title": "...",
  "description": "one or two sentences describing the material",
  "subject": "Mathematics" or "Physics" or null,
  "competency_name": "<exact name from the list above>" or null,
  "grade_level": "S1" or "S2" or "S3" or null,
  "difficulty_level": "Beginner" or "Intermediate" or "Advanced" or null,
  "content_type": "PDF" or "Video" or "Article" or "Interactive Exercise" or null,
  "duration_minutes": integer or null
}}"""

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        raw_json = message.content[0].text.strip()
        # Strip any accidental markdown fences
        raw_json = re.sub(r"^```(?:json)?\s*", "", raw_json)
        raw_json = re.sub(r"\s*```$", "", raw_json)
        extracted = json.loads(raw_json)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Claude extraction failed: %s", exc)
        raise HTTPException(status_code=502, detail="AI extraction failed — fill fields manually")

    return {
        "title":            extracted.get("title") or raw["title"] or None,
        "description": extracted.get("description") or None,
        "subject": extracted.get("subject") if extracted.get("subject") in _VALID_SUBJECTS else None,
        "competency_name": extracted.get("competency_name") if extracted.get("competency_name") in competencies else None,
        "grade_level": extracted.get("grade_level") if extracted.get("grade_level") in _VALID_GRADES else None,
        "difficulty_level": extracted.get("difficulty_level") if extracted.get("difficulty_level") in _VALID_DIFFICULTIES else None,
        "content_type": extracted.get("content_type") if extracted.get("content_type") in _VALID_CONTENT_TYPES else None,
        "duration_minutes": extracted.get("duration_minutes") if isinstance(extracted.get("duration_minutes"), int) else None,
        "file_url": url,
        "link_type": raw["link_type"],
    }


# ── PDF text extractor ─────────────────────────────────────────────────────────

def extract_pdf_text(url: str, max_pages: int = 50) -> str:
    """
    Download a PDF from `url` and extract its text content.
    Returns the extracted text (capped at 100,000 chars).
    Raises ValueError if the PDF cannot be downloaded or parsed.
    """
    try:
        from pypdf import PdfReader
    except ImportError:
        raise ValueError("pypdf is not installed — run: pip install pypdf")

    try:
        resp = _safe_request("GET", url, stream=True, timeout=30)
        resp.raise_for_status()
        content = _read_stream_with_cap(resp)
    except Exception as exc:
        raise ValueError(f"Could not download PDF: {exc}")
    finally:
        try:
            resp.close()  # type: ignore[name-defined]
        except Exception:
            pass

    try:
        reader = PdfReader(io.BytesIO(content))
        parts = []
        for page in reader.pages[:max_pages]:
            text = page.extract_text()
            if text:
                parts.append(text.strip())
        full_text = "\n\n".join(parts)
        return full_text[:100_000]
    except Exception as exc:
        raise ValueError(f"Could not parse PDF: {exc}")
