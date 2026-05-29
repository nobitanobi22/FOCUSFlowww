import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Text, DateTime,
    ForeignKey, ARRAY, Boolean
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    sessions = relationship("Session", back_populates="user")
    patterns = relationship("UserPattern", back_populates="user", uselist=False)


class Session(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    intent_raw = Column(Text, nullable=False)
    intent_expanded = Column(JSONB)
    intent_vector = Column(Vector(384))
    intent_spread = Column(Float)
    state = Column(String, default="active")
    started_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    ended_at = Column(DateTime(timezone=True))
    duration_minutes = Column(Integer)
    final_drift_score = Column(Float)
    completion_score = Column(Float)

    user = relationship("User", back_populates="sessions")
    events = relationship("SessionEvent", back_populates="session", order_by="SessionEvent.timestamp")
    transitions = relationship("SessionTransition", back_populates="session", order_by="SessionTransition.timestamp")


class SessionEvent(Base):
    __tablename__ = "session_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    url = Column(Text, nullable=False)
    title = Column(Text)
    content_type = Column(String)
    extracted_text = Column(Text)
    content_vector = Column(Vector(384))
    drift_score = Column(Float)
    immediate_similarity = Column(Float)
    momentum_score = Column(Float)
    estimated_read_time_seconds = Column(Integer)
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow)

    session = relationship("Session", back_populates="events")


class SessionTransition(Base):
    __tablename__ = "session_transitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    from_state = Column(String, nullable=False)
    to_state = Column(String, nullable=False)
    drift_score = Column(Float)
    trigger_event_id = Column(UUID(as_uuid=True), ForeignKey("session_events.id"))
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow)

    session = relationship("Session", back_populates="transitions")


class UserPattern(Base):
    __tablename__ = "user_patterns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True)
    avg_focus_duration_minutes = Column(Float)
    best_focus_hour = Column(Integer)
    topic_completion_rate = Column(Float)
    recovery_rate = Column(Float)
    common_drift_topics = Column(ARRAY(Text))
    velocity_trend = Column(Float)
    computed_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="patterns")
