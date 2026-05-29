from datetime import datetime
from celery import Celery
from celery.schedules import crontab
from sqlalchemy import func
from config import get_settings

settings = get_settings()

celery = Celery("focusflow", broker=settings.redis_url, backend=settings.redis_url)

celery.conf.beat_schedule = {
    "nightly-patterns": {
        "task": "tasks.compute_all_user_patterns",
        "schedule": crontab(hour=2, minute=0),
    }
}
celery.conf.timezone = "UTC"


def _get_db():
    """Get a DB session inside a Celery task (no FastAPI dependency injection)."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(settings.database_url, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    return Session()


@celery.task(name="tasks.compute_all_user_patterns")
def compute_all_user_patterns():
    """Trigger per-user pattern computation for all users."""
    db = _get_db()
    try:
        from models import User

        users = db.query(User).all()
        for user in users:
            compute_user_patterns.delay(str(user.id))
    finally:
        db.close()


@celery.task(name="tasks.compute_user_patterns")
def compute_user_patterns(user_id: str):
    """Aggregate learning patterns for a single user across all completed sessions."""
    db = _get_db()
    try:
        from models import Session, SessionTransition, UserPattern

        sessions = (
            db.query(Session)
            .filter(Session.user_id == user_id, Session.state == "completed")
            .all()
        )

        if len(sessions) < 3:
            return  # not enough data yet

        # ── Average focus duration before first drift ─────────────────────────
        focus_durations = []
        for session in sessions:
            first_drift = (
                db.query(SessionTransition)
                .filter(
                    SessionTransition.session_id == session.id,
                    SessionTransition.to_state.in_(["drifting", "deeply_drifted"]),
                )
                .order_by(SessionTransition.timestamp)
                .first()
            )
            if first_drift and session.started_at:
                delta = (first_drift.timestamp - session.started_at).total_seconds() / 60
                focus_durations.append(delta)

        avg_focus = sum(focus_durations) / len(focus_durations) if focus_durations else 0

        # ── Topic completion rate ─────────────────────────────────────────────
        completed_on_topic = sum(
            1 for s in sessions if s.completion_score and s.completion_score > 0.6
        )
        completion_rate = completed_on_topic / len(sessions)

        # ── Recovery rate ─────────────────────────────────────────────────────
        session_ids = [s.id for s in sessions]
        all_transitions = (
            db.query(SessionTransition)
            .filter(SessionTransition.session_id.in_(session_ids))
            .all()
        )
        drift_events = [
            t for t in all_transitions if t.to_state in ("drifting", "deeply_drifted")
        ]
        recovery_events = [t for t in all_transitions if t.to_state == "recovered"]
        recovery_rate = (
            len(recovery_events) / len(drift_events) if drift_events else 1.0
        )

        # ── Best focus hour ───────────────────────────────────────────────────
        good_sessions = [
            s for s in sessions if s.completion_score and s.completion_score > 0.6
        ]
        session_hours = [s.started_at.hour for s in good_sessions if s.started_at]
        best_hour = (
            max(set(session_hours), key=session_hours.count) if session_hours else 9
        )

        # ── Velocity trend (simple linear slope of completion_score over time) ─
        scores = [
            s.completion_score
            for s in sorted(sessions, key=lambda s: s.started_at)
            if s.completion_score is not None
        ]
        if len(scores) >= 4:
            mid = len(scores) // 2
            velocity_trend = (sum(scores[mid:]) / len(scores[mid:])) - (
                sum(scores[:mid]) / len(scores[:mid])
            )
        else:
            velocity_trend = 0.0

        # ── Upsert pattern ────────────────────────────────────────────────────
        pattern = db.query(UserPattern).filter(UserPattern.user_id == user_id).first()
        if pattern is None:
            pattern = UserPattern(user_id=user_id)
            db.add(pattern)

        pattern.avg_focus_duration_minutes = avg_focus
        pattern.best_focus_hour = best_hour
        pattern.topic_completion_rate = completion_rate
        pattern.recovery_rate = recovery_rate
        pattern.velocity_trend = velocity_trend
        pattern.computed_at = datetime.utcnow()
        db.commit()

    finally:
        db.close()
