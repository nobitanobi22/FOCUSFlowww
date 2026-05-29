from enum import Enum


class SessionState(str, Enum):
    ACTIVE = "active"
    FOCUSED = "focused"
    DRIFTING = "drifting"
    DEEPLY_DRIFTED = "deeply_drifted"
    RECOVERED = "recovered"
    COMPLETED = "completed"


def next_state(current: SessionState, drift_score: float) -> SessionState:
    """Determine next state from current state and drift score."""
    if current == SessionState.COMPLETED:
        return current

    if drift_score < 0.3:
        # Was drifting → now on track = RECOVERED
        if current in (SessionState.DRIFTING, SessionState.DEEPLY_DRIFTED):
            return SessionState.RECOVERED
        return SessionState.FOCUSED

    elif drift_score < 0.6:
        return SessionState.DRIFTING

    else:
        return SessionState.DEEPLY_DRIFTED


def get_message(state: SessionState, drift_score: float, minutes_drifted: int = 0) -> str:
    """Human-readable message for current state."""
    if state in (SessionState.FOCUSED, SessionState.ACTIVE):
        return "On track ✓"
    elif state == SessionState.RECOVERED:
        return "Back on track ↩"
    elif state == SessionState.DRIFTING:
        return f"Drifting for {minutes_drifted} min — drift score {drift_score:.0%}"
    elif state == SessionState.DEEPLY_DRIFTED:
        return f"Off topic for {minutes_drifted} min — drift score {drift_score:.0%}. Last relevant content was a while ago."
    elif state == SessionState.COMPLETED:
        return "Session complete"
    return ""


def should_log_transition(old_state: SessionState, new_state: SessionState) -> bool:
    """Only log when state actually changes."""
    return old_state != new_state
