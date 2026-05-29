from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import get_settings

settings = get_settings()

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables and enable pgvector extension."""
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    Base.metadata.create_all(bind=engine)
    # IVFFlat indexes require rows to exist first — create them lazily
    # They are created by a migration script after first data is loaded.
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_session_events_session_ts
            ON session_events (session_id, timestamp)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_session_transitions_session_ts
            ON session_transitions (session_id, timestamp)
        """))
        conn.commit()
