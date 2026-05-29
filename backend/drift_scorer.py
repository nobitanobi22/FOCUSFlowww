import numpy as np
from typing import List
from intent_engine import embed_text


def cosine_similarity(a: list, b: list) -> float:
    a, b = np.array(a), np.array(b)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


async def compute_drift(
    intent_vector: list,
    content_text: str,
    recent_events: list,      # last 5 SessionEvent ORM objects (most recent first)
    read_time_seconds: int,
) -> dict:
    """
    Momentum-weighted drift score.

    drift_score = 1 - (
        0.5 × cosine_similarity(intent, current_content)
      + 0.3 × session_momentum
      + 0.2 × time_weight_factor
    )

    Ranges 0.0 (perfectly on-topic) → 1.0 (completely off-topic).
    """
    # 1. Embed current content
    content_vector = embed_text(content_text)

    # 2. Immediate alignment: how similar is THIS page to the intent?
    immediate = cosine_similarity(intent_vector, content_vector)

    # 3. Session momentum: weighted average over last 5 events (exponential decay)
    weights = [0.4, 0.25, 0.15, 0.1, 0.1]
    if recent_events:
        # drift_score → alignment = 1 - drift_score
        past_alignments = [1.0 - (e.drift_score or 0.5) for e in recent_events[:5]]
        # Pad with immediate if fewer than 5 past events
        while len(past_alignments) < 5:
            past_alignments.append(immediate)
        momentum = sum(w * s for w, s in zip(weights, past_alignments))
    else:
        momentum = immediate

    # 4. Time weight: cap at 30 minutes; longer engagement = more weight
    time_w = min(read_time_seconds / 1800.0, 1.0)

    # 5. Final alignment score, then invert to drift
    alignment = 0.5 * immediate + 0.3 * momentum + 0.2 * (immediate * time_w)
    drift_score = float(max(0.0, min(1.0, 1.0 - alignment)))

    return {
        "drift_score": drift_score,
        "immediate_similarity": float(immediate),
        "momentum_score": float(momentum),
        "content_vector": content_vector,
    }
