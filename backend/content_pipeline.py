import re
import httpx
from config import get_settings

settings = get_settings()


def detect_type(url: str) -> str:
    if "youtube.com/watch" in url or "youtu.be/" in url:
        return "youtube"
    if "github.com" in url and len(url.rstrip("/").split("/")) >= 5:
        return "github"
    if url.lower().endswith(".pdf"):
        return "pdf"
    return "article"


async def extract_content(url: str, raw_text: str) -> dict:
    """Route to the appropriate extractor. Returns {text, type, read_time}."""
    content_type = detect_type(url)

    if content_type == "youtube":
        return await extract_youtube(url)
    elif content_type == "github":
        return await extract_github(url)
    elif content_type == "article":
        return extract_article(raw_text)
    else:
        return {"text": raw_text[:2000], "type": "other", "read_time": 60}


async def extract_youtube(url: str) -> dict:
    """Fetch title + description + tags from YouTube Data API."""
    video_id = _parse_video_id(url)
    if not video_id or not settings.youtube_api_key:
        return {"text": url, "type": "youtube", "read_time": 300}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://www.googleapis.com/youtube/v3/videos",
                params={
                    "id": video_id,
                    "key": settings.youtube_api_key,
                    "part": "snippet,contentDetails",
                },
            )
            data = resp.json()

        if not data.get("items"):
            return {"text": url, "type": "youtube", "read_time": 300}

        snippet = data["items"][0]["snippet"]
        tags = " ".join(snippet.get("tags", [])[:15])
        text = f"{snippet['title']} {snippet.get('description', '')[:600]} {tags}"
        return {"text": text.strip(), "type": "youtube", "read_time": 300}

    except Exception:
        return {"text": url, "type": "youtube", "read_time": 300}


async def extract_github(url: str) -> dict:
    """Fetch repo name + description + topics + README snippet."""
    parts = url.rstrip("/").split("/")
    if len(parts) < 5:
        return {"text": url, "type": "github", "read_time": 120}

    owner, repo = parts[3], parts[4]
    headers = {}
    if settings.github_token:
        headers["Authorization"] = f"token {settings.github_token}"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            repo_resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}", headers=headers
            )
            repo_data = repo_resp.json()

            readme_resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/readme",
                headers={**headers, "Accept": "application/vnd.github.raw"},
            )
            readme = readme_resp.text[:1200] if readme_resp.status_code == 200 else ""

        topics = " ".join(repo_data.get("topics", []))
        text = (
            f"{repo_data.get('name', '')} "
            f"{repo_data.get('description', '')} "
            f"{topics} {readme}"
        )
        return {"text": text.strip()[:3000], "type": "github", "read_time": 180}

    except Exception:
        return {"text": url, "type": "github", "read_time": 180}


def extract_article(raw_text: str) -> dict:
    """
    Try readabilipy (Mozilla Readability) for clean body text.
    Falls back to stripping HTML tags from raw_text.
    """
    try:
        from readabilipy import simple_json_from_html_string

        article = simple_json_from_html_string(raw_text, use_readability=True)
        text = article.get("plain_text") or article.get("content") or raw_text
        if isinstance(text, list):
            text = " ".join([t.get("text", "") for t in text])
        text = text[:3000]
    except Exception:
        # Simple HTML tag stripper fallback
        text = re.sub(r"<[^>]+>", " ", raw_text)
        text = re.sub(r"\s+", " ", text).strip()[:3000]

    words = len(text.split())
    read_time = int((words / 200) * 60)  # 200 WPM average
    return {"text": text, "type": "article", "read_time": max(30, read_time)}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_video_id(url: str) -> str | None:
    """Extract YouTube video ID from URL."""
    if "v=" in url:
        return url.split("v=")[-1].split("&")[0]
    if "youtu.be/" in url:
        return url.split("youtu.be/")[-1].split("?")[0]
    return None
