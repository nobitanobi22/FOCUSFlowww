import numpy as np
from intent_engine import embed_text


def cosine_similarity(a: list, b: list) -> float:
    a, b = np.array(a, dtype=float), np.array(b, dtype=float)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


async def compute_drift(
    intent_vector: list,
    content_text: str,
    recent_events: list,
    read_time_seconds: int,
) -> dict:
    if isinstance(intent_vector, str):
        import re
        nums = re.findall(r'[-+]?\d*\.?\d+[eE]?[-+]?\d*', intent_vector)
        intent_vector = [float(x) for x in nums]

    content_vector = embed_text(content_text)

    immediate = cosine_similarity(intent_vector, content_vector)

    weights = [0.4, 0.25, 0.15, 0.1, 0.1]
    if recent_events:
        past_alignments = [1.0 - (e.drift_score or 0.5) for e in recent_events[:5]]
        while len(past_alignments) < 5:
            past_alignments.append(immediate)
        momentum = sum(w * s for w, s in zip(weights, past_alignments))
    else:
        momentum = immediate

    time_w = min(read_time_seconds / 1800.0, 1.0)
    alignment = 0.5 * immediate + 0.3 * momentum + 0.2 * (immediate * time_w)
    drift_score = float(max(0.0, min(1.0, 1.0 - alignment)))

    return {
        "drift_score": drift_score,
        "immediate_similarity": float(immediate),
        "momentum_score": float(momentum),
        "content_vector": content_vector,
    }