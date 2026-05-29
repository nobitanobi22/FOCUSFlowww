import uuid
from datetime import datetime
from typing import List, Dict
import json

import redis
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import get_db, init_db
from models import User, Session as SessionModel, SessionEvent, SessionTransition, UserPattern
from schemas import (
    RegisterRequest, LoginRequest, TokenResponse,
    StartSessionRequest, EndSessionRequest, SessionSummary, SessionDetail,
    EventIn, EventResponse, EventOut, TransitionOut,
    MetricsSummary, PatternOut, DriftPoint,
)
from auth import hash_password, verify_password, create_token, get_current_user
from intent_engine import expand_intent, build_intent_vector
from content_pipeline import extract_content
from drift_scorer import compute_drift
from state_machine import SessionState, next_state, get_message, should_log_transition
from config import get_settings

settings = get_settings()
app = FastAPI(title="FocusFlow API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "chrome-extension://*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis for live session state + WebSocket broadcasting
_redis = redis.from_url(settings.redis_url, decode_responses=True)

# In-process WebSocket connections: session_id → list of WebSocket objects
active_connections: Dict[str, List[WebSocket]] = {}


@app.on_event("startup")
async def startup():
    init_db()


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=TokenResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(400, "Email already registered")
    user = User(email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(str(user.id), user.email)
    return TokenResponse(access_token=token, user_id=str(user.id), email=user.email)


@app.post("/auth/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(str(user.id), user.email)
    return TokenResponse(access_token=token, user_id=str(user.id), email=user.email)


# ── Sessions ──────────────────────────────────────────────────────────────────

@app.post("/sessions/start")
async def start_session(
    body: StartSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Expand intent via LLM
    try:
        expanded = await expand_intent(body.intent)
    except Exception as e:
        # Graceful fallback: create minimal expansion
        expanded = {
            "core_concepts": [body.intent],
            "related_concepts": [],
            "excluded_concepts": [],
            "depth": "intermediate",
            "estimated_duration_minutes": body.duration_minutes,
        }

    # 2. Embed intent → centroid vector + spread
    try:
        intent_vector, intent_spread = await build_intent_vector(expanded)
    except Exception:
        intent_vector, intent_spread = None, 0.3

    # 3. Persist session
    session = SessionModel(
        user_id=current_user.id,
        intent_raw=body.intent,
        intent_expanded=expanded,
        intent_vector=intent_vector,
        intent_spread=intent_spread,
        state=SessionState.ACTIVE,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # 4. Store live state in Redis (TTL 24h)
    session_key = f"session:{session.id}"
    _redis.setex(
        session_key,
        86400,
        json.dumps({
            "state": SessionState.ACTIVE,
            "drift_score": 0.0,
            "event_count": 0,
            "started_at": session.started_at.isoformat(),
        }),
    )

    return {
        "session_id": str(session.id),
        "intent_expanded": expanded,
        "state": session.state,
    }


@app.post("/sessions/end")
async def end_session(
    body: EndSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session_or_404(db, body.session_id, current_user.id)

    # Compute completion score = average (1 - drift_score) across all events
    events = session.events
    if events:
        completion_score = sum(1.0 - (e.drift_score or 0.5) for e in events) / len(events)
    else:
        completion_score = 0.0

    now = datetime.utcnow()
    session.ended_at = now
    session.state = SessionState.COMPLETED
    session.final_drift_score = _get_redis_drift(str(session.id))
    session.completion_score = round(completion_score, 3)
    session.duration_minutes = max(
        1, int((now - session.started_at).total_seconds() / 60)
    )
    db.commit()

    # Trigger nightly pattern computation immediately for freshness
    try:
        from tasks import compute_user_patterns
        compute_user_patterns.delay(str(current_user.id))
    except Exception:
        pass

    return {"summary": SessionSummary.model_validate(session).model_dump()}


@app.get("/sessions", response_model=List[SessionSummary])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sessions = (
        db.query(SessionModel)
        .filter(SessionModel.user_id == current_user.id)
        .order_by(SessionModel.started_at.desc())
        .all()
    )
    return [SessionSummary.model_validate(s) for s in sessions]


@app.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session_or_404(db, session_id, current_user.id)
    return SessionDetail.model_validate(session)


# ── Events (called by Chrome extension) ──────────────────────────────────────

@app.post("/events", response_model=EventResponse)
async def receive_event(
    body: EventIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session_or_404(db, body.session_id, current_user.id)

    if session.state == SessionState.COMPLETED:
        raise HTTPException(400, "Session already completed")

    # 1. Extract clean content
    extracted = await extract_content(body.url, body.text or "")
    content_text = extracted["text"]
    read_time = extracted["read_time"]

    # 2. Get last 5 events for momentum
    recent_events = (
        db.query(SessionEvent)
        .filter(SessionEvent.session_id == session.id)
        .order_by(SessionEvent.timestamp.desc())
        .limit(5)
        .all()
    )

    # 3. Compute drift
    if session.intent_vector is None:
        drift_result = {"drift_score": 0.5, "immediate_similarity": 0.5,
                        "momentum_score": 0.5, "content_vector": None}
    else:
        drift_result = await compute_drift(
            intent_vector=session.intent_vector,
            content_text=content_text,
            recent_events=recent_events,
            read_time_seconds=read_time,
        )

    drift_score = drift_result["drift_score"]

    # 4. Determine new state
    old_state = SessionState(session.state)
    new_state = next_state(old_state, drift_score)

    # 5. Persist event
    event = SessionEvent(
        session_id=session.id,
        url=body.url,
        title=body.title,
        content_type=extracted["type"],
        extracted_text=content_text[:2000],
        content_vector=drift_result.get("content_vector"),
        drift_score=drift_score,
        immediate_similarity=drift_result["immediate_similarity"],
        momentum_score=drift_result["momentum_score"],
        estimated_read_time_seconds=read_time,
        timestamp=datetime.utcnow(),
    )
    db.add(event)
    db.flush()  # get event.id before transition

    # 6. Log state transition if changed
    if should_log_transition(old_state, new_state):
        transition = SessionTransition(
            session_id=session.id,
            from_state=old_state,
            to_state=new_state,
            drift_score=drift_score,
            trigger_event_id=event.id,
        )
        db.add(transition)
        session.state = new_state

    db.commit()

    # 7. Update Redis + broadcast via WebSocket
    redis_state = {
        "state": str(new_state),
        "drift_score": drift_score,
        "event_count": len(recent_events) + 1,
    }
    _redis.setex(f"session:{session.id}", 86400, json.dumps(redis_state))
    await _broadcast(str(session.id), redis_state)

    # 8. Calculate minutes drifted for message
    minutes_drifted = 0
    if new_state in (SessionState.DRIFTING, SessionState.DEEPLY_DRIFTED):
        last_focused = (
            db.query(SessionTransition)
            .filter(
                SessionTransition.session_id == session.id,
                SessionTransition.to_state.in_(["focused", "recovered", "active"]),
            )
            .order_by(SessionTransition.timestamp.desc())
            .first()
        )
        if last_focused:
            minutes_drifted = int(
                (datetime.utcnow() - last_focused.timestamp).total_seconds() / 60
            )

    return EventResponse(
        drift_score=drift_score,
        state=str(new_state),
        message=get_message(new_state, drift_score, minutes_drifted),
        event_id=str(event.id),
    )


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()

    if session_id not in active_connections:
        active_connections[session_id] = []
    active_connections[session_id].append(websocket)

    # Send current state immediately on connect
    cached = _redis.get(f"session:{session_id}")
    if cached:
        await websocket.send_json(json.loads(cached))

    try:
        while True:
            await websocket.receive_text()  # keep-alive ping
    except WebSocketDisconnect:
        active_connections[session_id].remove(websocket)
        if not active_connections[session_id]:
            del active_connections[session_id]


# ── Metrics ───────────────────────────────────────────────────────────────────

@app.get("/metrics/summary", response_model=MetricsSummary)
def metrics_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sessions = (
        db.query(SessionModel)
        .filter(
            SessionModel.user_id == current_user.id,
            SessionModel.state == "completed",
        )
        .all()
    )

    if not sessions:
        return MetricsSummary(
            total_sessions=0,
            avg_focus_duration=0.0,
            avg_completion_score=0.0,
            total_events=0,
        )

    avg_focus = sum(s.duration_minutes or 0 for s in sessions) / len(sessions)
    avg_completion = sum(s.completion_score or 0 for s in sessions) / len(sessions)
    total_events = sum(len(s.events) for s in sessions)

    return MetricsSummary(
        total_sessions=len(sessions),
        avg_focus_duration=round(avg_focus, 1),
        avg_completion_score=round(avg_completion, 3),
        total_events=total_events,
    )


@app.get("/metrics/patterns", response_model=PatternOut)
def metrics_patterns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pattern = (
        db.query(UserPattern).filter(UserPattern.user_id == current_user.id).first()
    )
    if not pattern:
        raise HTTPException(404, "No patterns computed yet. Complete 3+ sessions.")
    return PatternOut.model_validate(pattern)


@app.get("/metrics/sessions/{session_id}/curve", response_model=List[DriftPoint])
def session_curve(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_session_or_404(db, session_id, current_user.id)
    return [
        DriftPoint(
            timestamp=e.timestamp,
            drift_score=e.drift_score or 0.0,
            state=session.state,
            url=e.url,
            content_type=e.content_type,
        )
        for e in session.events
    ]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_session_or_404(db, session_id: str, user_id) -> SessionModel:
    session = (
        db.query(SessionModel)
        .filter(SessionModel.id == session_id, SessionModel.user_id == user_id)
        .first()
    )
    if not session:
        raise HTTPException(404, "Session not found")
    return session


def _get_redis_drift(session_id: str) -> float:
    cached = _redis.get(f"session:{session_id}")
    if cached:
        return json.loads(cached).get("drift_score", 0.0)
    return 0.0


async def _broadcast(session_id: str, payload: dict):
    """Push drift update to all connected WebSocket clients for this session."""
    for ws in active_connections.get(session_id, []):
        try:
            await ws.send_json(payload)
        except Exception:
            pass
