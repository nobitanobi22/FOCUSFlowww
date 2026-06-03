import json
import numpy as np
from anthropic import Anthropic
from openai import OpenAI
from config import get_settings

settings = get_settings()
_openai_client = None

def get_openai():
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAI(api_key=settings.openai_api_key)
    return _openai_client

async def expand_intent(raw_intent: str) -> dict:
    client = Anthropic(api_key=settings.anthropic_api_key)
    response = client.messages.create(
        model="claude-haiku-20240307",
        max_tokens=600,
        messages=[{
            "role": "user",
            "content": f"""Given this learning intent: "{raw_intent}"

Return a JSON object with exactly these keys:
- core_concepts: list of 5-8 directly relevant concepts (strings)
- related_concepts: list of 3-5 related but broader concepts (strings)
- excluded_concepts: list of 2-3 things that sound related but aren't (strings)
- depth: one of "beginner" | "intermediate" | "advanced"
- estimated_duration_minutes: integer estimate

Return only valid JSON, no markdown, no other text."""
        }]
    )
    raw = response.content[0].text.strip().replace("```json", "").replace("```", "").strip()
    return json.loads(raw)

def embed_texts(texts: list[str]) -> list[list[float]]:
    client = get_openai()
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts
    )
    return [item.embedding for item in response.data]

def embed_text(text: str) -> list[float]:
    return embed_texts([text])[0]

async def build_intent_vector(expanded: dict) -> tuple[list, float]:
    all_concepts = expanded.get("core_concepts", []) + expanded.get("related_concepts", [])
    if not all_concepts:
        raise ValueError("No concepts to embed")
    
    embeddings = embed_texts(all_concepts)
    arr = np.array(embeddings)
    centroid = np.mean(arr, axis=0)
    centroid_norm = centroid / (np.linalg.norm(centroid) + 1e-9)
    
    similarities = [float(np.dot(np.array(e), centroid_norm)) for e in embeddings]
    spread = float(1.0 - np.mean(similarities))
    
    return centroid_norm.tolist(), spread