from uuid import UUID
from pydantic import BaseModel, EmailStr, field_validator
import uuid as _uuid_mod
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime
import uuid



# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: Any  # uuid
    email: str


# ── Sessions ──────────────────────────────────────────────────────────────────

class StartSessionRequest(BaseModel):
    intent: str
    duration_minutes: int = 60


class EndSessionRequest(BaseModel):
    session_id: Any  # uuid


class SessionSummary(BaseModel):
    id: Any = ""
    intent_raw: str
    intent_expanded: Optional[dict]
    state: str
    started_at: datetime
    ended_at: Optional[datetime]
    duration_minutes: Optional[int]
    final_drift_score: Optional[float]
    completion_score: Optional[float]

    class Config:
        json_encoders = {UUID: str}
        from_attributes = True
        json_encoders = {__import__("uuid").UUID: str}


class SessionDetail(SessionSummary):
    events: List["EventOut"] = []
    transitions: List["TransitionOut"] = []


# ── Events ────────────────────────────────────────────────────────────────────

class EventIn(BaseModel):
    session_id: Any  # uuid
    url: str
    title: Optional[str] = ""
    text: Optional[str] = ""
    timestamp: Optional[int] = None  # unix ms


class EventResponse(BaseModel):
    drift_score: float
    state: str
    message: str
    event_id: Any  # uuid


class EventOut(BaseModel):
    id: Any = ""
    url: str
    title: Optional[str]
    content_type: Optional[str]
    drift_score: Optional[float]
    immediate_similarity: Optional[float]
    estimated_read_time_seconds: Optional[int]
    timestamp: datetime

    class Config:
        from_attributes = True
        json_encoders = {__import__("uuid").UUID: str}


class TransitionOut(BaseModel):
    id: Any = ""
    from_state: str
    to_state: str
    drift_score: Optional[float]
    timestamp: datetime

    class Config:
        from_attributes = True
        json_encoders = {__import__("uuid").UUID: str}


# ── Metrics ───────────────────────────────────────────────────────────────────

class MetricsSummary(BaseModel):
    total_sessions: int
    avg_focus_duration: float
    avg_completion_score: float
    total_events: int


class PatternOut(BaseModel):
    avg_focus_duration_minutes: Optional[float]
    best_focus_hour: Optional[int]
    topic_completion_rate: Optional[float]
    recovery_rate: Optional[float]
    common_drift_topics: Optional[List[str]]
    velocity_trend: Optional[float]
    computed_at: Optional[datetime]

    class Config:
        from_attributes = True
        json_encoders = {__import__("uuid").UUID: str}


class DriftPoint(BaseModel):
    timestamp: datetime
    drift_score: float
    state: str
    url: str
    content_type: Optional[str]


# Update forward refs
SessionDetail.model_rebuild()
