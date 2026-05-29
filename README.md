# FocusFlow

A full-stack learning analytics platform that measures **semantic drift** — the gap between what you intended to learn and what you actually consumed — in real time.

Every productivity tool measures time. FocusFlow measures meaning.

> "I sat down to learn Kafka. 90 minutes later I was watching a documentary about octopuses. FocusFlow would have told me I drifted at minute 23."

---

## What It Does

You declare an intent: *"Learn Apache Kafka"*. FocusFlow expands that into a semantic concept profile using an LLM, embeds it into vector space, and stores it as your session's reference point.

As you browse, a Chrome extension silently captures every page you visit. The backend extracts meaningful content (strips ads, nav, boilerplate), embeds it, and computes a **drift score** — a number from 0 to 100 representing how far you've moved from your stated intent in semantic space.

That score updates in real time on your dashboard. When you've been off-topic for long enough that your session momentum is genuinely drifting — not just one YouTube break — the system surfaces it.

After enough sessions, a pattern engine tells you when you focus best, how long before your first drift, and whether you're improving.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)                                      │
│  content_script.js → captures URL, title, body text on every visit  │
│  background.js     → batches events, sends to API every 30s          │
│  popup             → shows live drift score, session controls         │
└────────────────────┬────────────────────────────────────────────────┘
                     │ POST /events
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FastAPI Backend (Python 3.11)                                       │
│                                                                      │
│  Content Pipeline    YouTube Data API + Mozilla Readability          │
│                      + GitHub REST API + pdfplumber                  │
│                      → clean semantic text regardless of source      │
│                                                                      │
│  Intent Engine       LLM (claude-haiku) expands "Learn Kafka" into  │
│                      {core_concepts, related_concepts, excluded}     │
│                      → embedded with sentence-transformers           │
│                      → centroid stored in pgvector                   │
│                                                                      │
│  Drift Scorer        momentum-weighted cosine distance:              │
│                      score = 1 − (0.5·similarity + 0.3·momentum     │
│                                  + 0.2·time_weight)                  │
│                                                                      │
│  State Machine       ACTIVE → FOCUSED → DRIFTING →                  │
│                      DEEPLY_DRIFTED → RECOVERED → COMPLETED          │
│                      every transition logged with timestamp          │
│                                                                      │
│  WebSocket           pushes live drift score to dashboard            │
│                      after every event processed                     │
└──────────┬──────────────────────────────────┬───────────────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────────┐          ┌──────────────────────┐
│  PostgreSQL + pgvector│          │  Redis               │
│  users               │          │  live session state  │
│  sessions            │          │  (TTL: 24h)          │
│  session_events      │          │  Celery task queue   │
│  session_transitions │          └──────────────────────┘
│  user_patterns       │                     │
│  vector indexes      │                     ▼
└──────────────────────┘          ┌──────────────────────┐
                                  │  Celery Worker        │
                                  │  nightly aggregation  │
                                  │  focus duration trend │
                                  │  recovery rate        │
                                  │  time-of-day patterns │
                                  └──────────────────────┘
                     ▲
┌────────────────────┴────────────────────────────────────────────────┐
│  Next.js 14 Frontend (TypeScript + Tailwind)                         │
│                                                                      │
│  /                   Declare intent, start session                   │
│  /dashboard          Live drift gauge + WebSocket + content timeline │
│  /sessions           History of all sessions with completion scores  │
│  /sessions/[id]      Drift curve, state trajectory, full content log │
│  /patterns           Focus heatmap, trends, recovery rate analytics  │
│  /login  /register   JWT auth                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts |
| Real-time | WebSocket (FastAPI native) |
| Backend | FastAPI, Python 3.11 |
| Auth | JWT + bcrypt |
| Embeddings | sentence-transformers / all-MiniLM-L6-v2 (local, no API cost) |
| Vector store | PostgreSQL + pgvector |
| Cache | Redis |
| Background jobs | Celery + Redis Beat |
| Content extraction | readabilipy, YouTube Data API v3, GitHub REST API, pdfplumber |
| Intent expansion | Anthropic API (claude-haiku — one call per session) |
| Extension | Vanilla JS, Manifest V3 |
| Infrastructure | Docker Compose (local) → AWS EC2 + RDS + ElastiCache (prod) |

---

## Local Setup

### Prerequisites
- Docker and Docker Compose
- Git
- Chrome / Brave / Edge

### 1. Clone and configure

```bash
git clone https://github.com/nobitanobi22/focusflow.git
cd focusflow

cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

Edit `backend/.env`:
```env
ANTHROPIC_API_KEY=sk-ant-...       # required
YOUTUBE_API_KEY=AIza...            # recommended
GITHUB_TOKEN=ghp_...               # recommended
JWT_SECRET=<run: openssl rand -hex 32>
```

### 2. Start all services

```bash
docker compose up --build
```

Starts: PostgreSQL with pgvector, Redis, FastAPI backend, Celery worker, Next.js frontend.

First run downloads the sentence-transformers model (~90 MB). Takes ~4 minutes. Every run after that is instant.

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

### 3. Load the Chrome extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` folder

### 4. Use it

1. Register at http://localhost:3000/register
2. Declare an intent → Start Session
3. Browse normally — the extension tracks silently
4. Watch the drift gauge update live at /dashboard
5. The extension badge shows your real-time drift score (green / yellow / red)
6. End the session → full drift curve and content log at /sessions/[id]

---

## How the Drift Score Works

```
drift_score = 1 − (
    0.5 × cosine_similarity(intent_vector, current_content_vector)
  + 0.3 × session_momentum
  + 0.2 × time_weight
)
```

**Intent vector:** when you type "Learn Kafka", an LLM expands it into 8-12 concepts (core, related, excluded). Each concept is embedded with `sentence-transformers`, and the centroid of those embeddings becomes your session's reference point in 384-dimensional space.

**Immediate similarity (0.5):** cosine distance between that centroid and the current page's embedding.

**Session momentum (0.3):** exponentially-weighted average over the last 5 content pieces — weights `[0.4, 0.25, 0.15, 0.1, 0.1]`. One YouTube break barely moves the needle. Five consecutive off-topic pages definitely does.

**Time weight (0.2):** a 20-minute article matters more than a 30-second bounce. Estimated reading time used as a proxy for cognitive engagement.

**Score interpretation:**
- `0–30` → FOCUSED (green)
- `30–60` → DRIFTING (amber)  
- `60–100` → DEEPLY DRIFTED (red)

Recovery is tracked explicitly — returning to focus after drifting is logged as a state transition and counted in your recovery rate.

---

## API Reference

```
POST   /auth/register
POST   /auth/login

POST   /sessions/start          → LLM expansion + embedding + session creation
POST   /sessions/end            → computes completion score, triggers pattern job
GET    /sessions                → paginated session list
GET    /sessions/{id}           → full session with events + state transitions

POST   /events                  → called by Chrome extension (main hot path)
WS     /ws/{session_id}         → live drift score stream to dashboard

GET    /metrics/summary
GET    /metrics/patterns        → requires 3+ completed sessions
GET    /metrics/sessions/{id}/curve
```

Full interactive docs: http://localhost:8000/docs

---

## Development Without Docker

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
docker compose up postgres redis -d   # just the data layer
uvicorn main:app --reload --port 8000
```

**Celery (separate terminal):**
```bash
cd backend && source venv/bin/activate
celery -A tasks worker --beat --loglevel=info
```

**Frontend:**
```bash
cd frontend
npm install && npm run dev
```

---

## Project Structure

```
focusflow/
├── backend/
│   ├── main.py              FastAPI app — all routes, WebSocket, startup
│   ├── models.py            SQLAlchemy ORM (User, Session, SessionEvent, ...)
│   ├── schemas.py           Pydantic request/response schemas
│   ├── database.py          PostgreSQL connection, init_db (creates tables + indexes)
│   ├── auth.py              JWT creation/validation, bcrypt, get_current_user
│   ├── intent_engine.py     LLM intent expansion, sentence-transformer embedding
│   ├── drift_scorer.py      Momentum-weighted drift formula
│   ├── state_machine.py     State transition logic + human-readable messages
│   ├── content_pipeline.py  YouTube / Readability / GitHub / pdfplumber extractors
│   ├── tasks.py             Celery tasks — nightly pattern aggregation
│   ├── config.py            Pydantic settings from environment
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/src/
│   ├── app/
│   │   ├── page.tsx                Start session / home
│   │   ├── dashboard/page.tsx      Live drift gauge + WebSocket + content timeline
│   │   ├── sessions/page.tsx       Session history list
│   │   ├── sessions/[id]/page.tsx  Session detail — drift curve + state log
│   │   ├── patterns/page.tsx       Analytics dashboard
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── components/
│   │   ├── DriftGauge.tsx          SVG circular gauge, animates on score change
│   │   ├── DriftCurve.tsx          Recharts line chart with threshold lines
│   │   ├── ContentTimeline.tsx     Per-event cards with drift score + type icon
│   │   ├── PatternHeatmap.tsx      24h × 7d focus intensity heatmap
│   │   ├── SessionCard.tsx         Session list item with completion %
│   │   └── StateIndicator.tsx      FOCUSED / DRIFTING / RECOVERED badge
│   ├── lib/
│   │   ├── api.ts                  Typed API client (all endpoints)
│   │   └── websocket.ts            useSessionWebSocket hook with auto-reconnect
│   └── types/index.ts              Shared TypeScript interfaces
│
├── extension/
│   ├── manifest.json
│   ├── content_script.js    Injected into every page — captures URL + text
│   ├── background.js        Service worker — batches + flushes event queue
│   └── popup/
│       ├── popup.html
│       ├── popup.js
│       └── popup.css
│
├── docker-compose.yml
└── README.md
```

---

## License

MIT
