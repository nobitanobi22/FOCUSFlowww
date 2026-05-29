import json
import numpy as np
from anthropic import Anthropic
from sentence_transformers import SentenceTransformer
from config import get_settings

settings = get_settings()

_embedder: SentenceTransformer = None


def get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedder


async def expand_intent(raw_intent: str) -> dict:
    """Expand 'Learn Kafka' into structured concept profile via LLM."""
    client = Anthropic(api_key=settings.anthropic_api_key)

    response = client.messages.create(
        model="claude-haiku-20240307",
        max_tokens=600,
        messages=[
            {
                "role": "user",
                "content": f"""Given this learning intent: "{raw_intent}"

Return a JSON object with exactly these keys:
- core_concepts: list of 5-8 directly relevant concepts (strings)
- related_concepts: list of 3-5 related but broader concepts (strings)
- excluded_concepts: list of 2-3 things that sound related but aren't (strings)
- depth: one of "beginner" | "intermediate" | "advanced"
- estimated_duration_minutes: integer estimate for learning this topic

Return only valid JSON, no markdown, no other text.""",
            }
        ],
    )

    raw = response.content[0].text.strip()
    # Strip any accidental markdown fences
    raw = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(raw)


async def build_intent_vector(expanded: dict) -> tuple[list, float]:
    """
    Build centroid of all concept embeddings.
    Also compute spread = how broad/tight the intent is.
    A tight intent (e.g. 'Kafka consumer groups') has low spread.
    A broad intent (e.g. 'Learn distributed systems') has high spread.
    """
    embedder = get_embedder()
    all_concepts = expanded.get("core_concepts", []) + expanded.get("related_concepts", [])

    if not all_concepts:
        raise ValueError("No concepts to embed")

    embeddings = embedder.encode(all_concepts, normalize_embeddings=True)
    centroid = np.mean(embeddings, axis=0)
    # Re-normalise the centroid so cosine ops work correctly
    centroid_norm = centroid / (np.linalg.norm(centroid) + 1e-9)

    # Spread: mean cosine distance from centroid
    similarities = [float(np.dot(e, centroid_norm)) for e in embeddings]
    spread = float(1.0 - np.mean(similarities))

    return centroid_norm.tolist(), spread


def embed_text(text: str) -> list:
    """Embed arbitrary text for drift comparison."""
    embedder = get_embedder()
    vec = embedder.encode([text], normalize_embeddings=True)[0]
    return vec.tolist()
