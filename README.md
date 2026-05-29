# FocusFlow

**Learning session analytics engine.** A Chrome extension that passively tracks what you browse during a declared study session, computes real-time semantic drift between your declared intent and your actual browsing, and surfaces patterns across sessions to help you understand how you actually learn.

> "I sat down to learn Kafka and 90 minutes later I was watching a documentary about why octopuses are terrifying. FocusFlow makes drift visible in real time."

---

## Architecture

```
Chrome Extension (Manifest V3)
  → POST /events every 30s
FastAPI Backend
  → Content pipeline (YouTube API / Readability / GitHub API)
  → sentence-transformers (all-MiniLM-L6-v2) for embeddings
  → Momentum-weighted drift scorer
  → Session state machine (FOCUSED → DRIFTING → RECOVERED)
  → WebSocket for real-time dashboard updates
PostgreSQL + pgvector   Redis   Celery (nightly patterns)
Next.js 14 Dashboard
```

## Tech Stack

| Layer | Tech |
|---|---|
| Extension | Vanilla JS, Manifest V3 |
| Frontend | Next.js 14 + TypeScript + Tailwind |
| Charts | Recharts |
| Backend | FastAPI (Python 3.11) |
| Auth | JWT + bcrypt |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) — local, free, <50ms |
| Vector store | PostgreSQL + pgvector |
| Cache / Queue | Redis + Celery |
| Content extraction | readabilipy, YouTube Data API, GitHub REST API |
| Intent expansion | Anthropic API (claude-haiku) |
| Deploy | AWS EC2 + RDS + ElastiCache |

---

## Local Setup

### Prerequisites

- Docker + Docker Compose
- Git
- A Chromium-based browser (Chrome, Brave, Edge)
- API keys: Anthropic, YouTube Data API v3 (optional but recommended)

### 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/focusflow.git
cd focusflow
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

Edit `backend/.env` — fill in your keys:

```
ANTHROPIC_API_KEY=sk-ant-...
YOUTUBE_API_KEY=AIza...        # optional — YouTube content extraction
GITHUB_TOKEN=ghp_...           # optional — GitHub repo extraction
JWT_SECRET=some-long-random-string-here
```

Everything else can stay as-is for local dev.

### 3. Start all services

```bash
docker compose up --build
```

This starts:
- **PostgreSQL** (port 5432) with pgvector extension
- **Redis** (port 6379)
- **FastAPI backend** (port 8000)
- **Celery worker + beat** (nightly pattern jobs)
- **Next.js frontend** (port 3000)

First run takes ~3-5 minutes (downloads sentence-transformers model, ~90 MB).

### 4. Verify it's running

```bash
curl http://localhost:8000/docs       # FastAPI Swagger UI
```

Open http://localhost:3000 in your browser.

### 5. Load the Chrome extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder in this repo

The FocusFlow icon appears in your toolbar.

### 6. Use it

1. Register at http://localhost:3000/register
2. Click "Start Session" — type your intent (e.g. "Learn Apache Kafka")
3. The extension starts tracking your browsing immediately
4. Open http://localhost:3000/dashboard to see live drift
5. The extension badge shows your live drift score (green/yellow/red)

---

## Development (without Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start PostgreSQL and Redis manually or via Docker:
docker compose up postgres redis -d

cp .env.example .env              # edit with your keys
uvicorn main:app --reload --port 8000
```

### Celery worker (separate terminal)

```bash
cd backend
source venv/bin/activate
celery -A tasks worker --beat --loglevel=info
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev                        # → http://localhost:3000
```

---

## How Drift Works

```
drift_score = 1 - (
    0.5 × cosine_similarity(intent_vector, current_content_vector)
  + 0.3 × session_momentum
  + 0.2 × time_weight
)
```

- **0.0** = perfect alignment (reading a Kafka tutorial while learning Kafka)
- **0.5** = moderate drift (reading about distributed systems generally)
- **0.9** = deep drift (watching octopus videos)

**Momentum** = weighted average of last 5 content pieces (exponential decay: 0.4, 0.25, 0.15, 0.1, 0.1). One YouTube break barely moves the needle. Five consecutive drift events definitely does.

---

## API Reference

```
POST /auth/register
POST /auth/login
POST /sessions/start     → expands intent via LLM, stores embedding
POST /sessions/end       → computes completion score
GET  /sessions           → list all sessions
GET  /sessions/{id}      → full session with events + transitions
POST /events             → called by Chrome extension (batch)
WS   /ws/{session_id}    → live drift score stream
GET  /metrics/summary
GET  /metrics/patterns
GET  /metrics/sessions/{id}/curve
```

Full interactive docs at http://localhost:8000/docs

---

## Folder Structure

```
focusflow/
├── extension/
│   ├── manifest.json
│   ├── background.js       service worker: batches + sends events
│   ├── content_script.js   captures URL, title, body text per page
│   └── popup/
│       ├── popup.html/js/css
├── backend/
│   ├── main.py             FastAPI app, all routes, WebSocket
│   ├── models.py           SQLAlchemy ORM models
│   ├── schemas.py          Pydantic request/response schemas
│   ├── database.py         DB connection + init
│   ├── auth.py             JWT + bcrypt
│   ├── intent_engine.py    LLM expansion + sentence-transformer embedding
│   ├── drift_scorer.py     momentum-weighted cosine drift formula
│   ├── state_machine.py    FOCUSED/DRIFTING/RECOVERED transitions
│   ├── content_pipeline.py YouTube/GitHub/article/PDF extractors
│   ├── tasks.py            Celery nightly pattern aggregation
│   └── config.py           env var management
├── frontend/src/
│   ├── app/                Next.js app router pages
│   ├── components/         DriftGauge, DriftCurve, ContentTimeline, etc.
│   ├── lib/                api.ts, websocket.ts
│   └── types/index.ts
├── docker-compose.yml
└── README.md
```

---

## Resume Bullets

> Built a learning session analytics engine with a Chrome extension that passively captures browsing events and streams them to a FastAPI backend, which extracts content via a Readability + YouTube API pipeline, computes momentum-weighted semantic drift against a declared intent using sentence-transformers and pgvector, and models session state through a FOCUSED→DRIFTING→RECOVERED state machine with full transition logging.

> Engineered a WebSocket-powered real-time drift dashboard and a nightly Celery pattern engine surfacing focus duration trends, drift trigger clusters, and topic completion rates — deployed on AWS EC2 with RDS PostgreSQL and ElastiCache Redis.

---

## License

MIT
