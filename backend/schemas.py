from pydantic import BaseModel, EmailStr
from typing import Optional, List
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
    user_id: str
    email: str


# ── Sessions ──────────────────────────────────────────────────────────────────

class StartSessionRequest(BaseModel):
    intent: str
    duration_minutes: int = 60


class EndSessionRequest(BaseModel):
    session_id: str


class SessionSummary(BaseModel):
    id: str
    intent_raw: str
    intent_expanded: Optional[dict]
    state: str
    started_at: datetime
    ended_at: Optional[datetime]
    duration_minutes: Optional[int]
    final_drift_score: Optional[float]
    completion_score: Optional[float]

    class Config:
        from_attributes = True


class SessionDetail(SessionSummary):
    events: List["EventOut"] = []
    transitions: List["TransitionOut"] = []


# ── Events ────────────────────────────────────────────────────────────────────

class EventIn(BaseModel):
    session_id: str
    url: str
    title: Optional[str] = ""
    text: Optional[str] = ""
    timestamp: Optional[int] = None  # unix ms


class EventResponse(BaseModel):
    drift_score: float
    state: str
    message: str
    event_id: str


class EventOut(BaseModel):
    id: str
    url: str
    title: Optional[str]
    content_type: Optional[str]
    drift_score: Optional[float]
    immediate_similarity: Optional[float]
    estimated_read_time_seconds: Optional[int]
    timestamp: datetime

    class Config:
        from_attributes = True


class TransitionOut(BaseModel):
    id: str
    from_state: str
    to_state: str
    drift_score: Optional[float]
    timestamp: datetime

    class Config:
        from_attributes = True


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


class DriftPoint(BaseModel):
    timestamp: datetime
    drift_score: float
    state: str
    url: str
    content_type: Optional[str]


# Update forward refs
SessionDetail.model_rebuild()
