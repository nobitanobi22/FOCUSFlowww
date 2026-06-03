# FocusFlow

A full-stack learning session analytics engine. Declare what you want to learn, browse normally — FocusFlow tells you in real time how far you've drifted from your stated intent.

**Every productivity tool measures time. FocusFlow measures meaning.**

---

## Screenshots

**Live dashboard — "Learn Apache Kafka" session, drifted to Vevo**

![Dashboard showing drift score 90 while watching YouTube](docs/screenshots/dashboard-drift-90.png)

The drift gauge hit 90 (red) the moment YouTube opened. Content timeline shows exactly what was visited and when. WebSocket keeps the gauge live without polling.

---

**Drift curve — session reconstructed after ending**

![Session detail showing drift curve and stats](docs/screenshots/session-detail-curve.png)

22% on-topic overall. 3 pages visited, 2 state transitions. The curve tracks drift event by event. Below it, the state trajectory logs every transition — `active → drifting at 58%`, `drifting → deeply_drifted at 85%` — with timestamps.

---

**Content log — every page, individually scored**

![Session content log with drift scores per page](docs/screenshots/session-detail-log.png)

- Kafka Documentation → **58** (amber — related but drifting)
- YouTube → **85** (red — off topic)
- Vevo → **90** (red — completely off topic)

---

**Early in session — first Kafka docs page scored**

![Dashboard showing drift score 58 on Kafka docs](docs/screenshots/dashboard-drift-58.png)

With a minimal API key fallback (single-concept expansion), even Kafka docs score 58%. With a real Anthropic key, `claude-haiku` expands "Learn Kafka" to 8+ concepts and the Kafka docs page scores ~15–20%.

---

**Session summary**

![Session detail top showing metrics](docs/screenshots/session-detail-top.png)

---

## What drift actually means

```
drift_score = 1 − (
    0.5 × cosine_similarity(intent_vector, content_vector)
  + 0.3 × session_momentum
  + 0.2 × time_weight
)
```

When you type "Learn Kafka", an LLM (`claude-haiku`) expands it into a structured concept profile — core concepts, related concepts, excluded concepts. Each concept is embedded with `sentence-transformers` (all-MiniLM-L6-v2). The centroid of those embeddings becomes the session's reference point in 384-dimensional space.

**Immediate similarity (0.5)** — cosine distance between the centroid and the current page's embedding.

**Momentum (0.3)** — exponentially-weighted average over the last 5 pages (weights: 0.4, 0.25, 0.15, 0.1, 0.1). One YouTube break barely moves the needle. Five consecutive off-topic pages does.

**Time weight (0.2)** — longer engagement = more cognitive weight. Estimated reading time used as proxy.

| Score | Colour | State |
|---|---|---|
| 0–30 | 🟢 Green | FOCUSED |
| 30–60 | 🟡 Amber | DRIFTING |
| 60–100 | 🔴 Red | DEEPLY DRIFTED |

Recovery is tracked explicitly — `deeply_drifted → recovered` is logged as a transition and counted in your recovery rate.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)                                      │
│  content_script.js → captures URL, title, body text on every visit  │
│  background.js     → sends event to API on every page load           │
│  popup             → shows live drift score, session controls         │
└────────────────────┬────────────────────────────────────────────────┘
                     │ POST /events
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FastAPI Backend (Python 3.11)                                       │
│                                                                      │
│  Content Pipeline    YouTube Data API + Mozilla Readability          │
│                      + GitHub REST API + pdfplumber                  │
│                                                                      │
│  Intent Engine       LLM expands intent → concept profile            │
│                      → sentence-transformers centroid embedding      │
│                                                                      │
│  Drift Scorer        momentum-weighted cosine distance formula       │
│                                                                      │
│  State Machine       ACTIVE → FOCUSED → DRIFTING →                  │
│                      DEEPLY_DRIFTED → RECOVERED → COMPLETED          │
│                      every transition logged with timestamp          │
│                                                                      │
│  WebSocket           pushes live drift score to dashboard            │
└──────────┬──────────────────────────────────┬───────────────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────────┐          ┌──────────────────────┐
│  PostgreSQL + pgvector│          │  Redis               │
│  sessions            │          │  live session state  │
│  session_events      │          │  Celery task queue   │
│  session_transitions │          └──────────┬───────────┘
│  user_patterns       │                     ▼
└──────────────────────┘          ┌──────────────────────┐
                                  │  Celery Worker        │
                                  │  nightly pattern jobs │
                                  └──────────────────────┘
                     ▲
┌────────────────────┴────────────────────────────────────────────────┐
│  Next.js 14 Frontend (TypeScript + Tailwind)                         │
│  /              declare intent, start session                        │
│  /dashboard     live drift gauge + WebSocket + content timeline      │
│  /sessions/[id] drift curve, state trajectory, content log           │
│  /patterns      focus heatmap, trends, recovery rate analytics       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts |
| Real-time | WebSocket (FastAPI native) |
| Backend | FastAPI, Python 3.11 |
| Auth | JWT + bcrypt |
| Embeddings | sentence-transformers / all-MiniLM-L6-v2 — local, no API cost |
| Vector store | PostgreSQL + pgvector |
| Cache | Redis |
| Background jobs | Celery + Redis Beat |
| Content extraction | readabilipy, YouTube Data API v3, GitHub REST API, pdfplumber |
| Intent expansion | Anthropic API (claude-haiku — one call per session, ~$0.0001) |
| Extension | Vanilla JS, Manifest V3 |
| Infrastructure | Docker Compose (local) → AWS EC2 + RDS + ElastiCache (prod) |

---

## Local setup (Windows)

### Prerequisites
- Python 3.11 — [download](https://www.python.org/downloads/release/python-31110/)
- Node.js 20+
- PostgreSQL 16 — [download](https://www.postgresql.org/download/windows/) — install on port **5433**
- Redis — [download](https://github.com/tporadowski/redis/releases)
- Chrome / Brave / Edge

### 1. Clone

```bash
git clone https://github.com/nobitanobi22/FOCUSFlowww.git
cd FOCUSFlowww
```

### 2. Database setup

```bash
export PATH=$PATH:"/c/Program Files/PostgreSQL/16/bin"

psql -p 5433 -U postgres -c "CREATE DATABASE focusflow;"
psql -p 5433 -U postgres -c "CREATE USER \"user\" WITH PASSWORD 'password';"
psql -p 5433 -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE focusflow TO \"user\";"
psql -p 5433 -U postgres -d focusflow -c "GRANT ALL ON SCHEMA public TO \"user\";"
```

### 3. Environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5433/focusflow
REDIS_URL=redis://localhost:6379/0
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=any-long-random-string
JWT_EXPIRE_HOURS=168
```

```bash
cp frontend/.env.local.example frontend/.env.local
```

### 4. Backend

```bash
cd backend
py -3.11 -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 6. Chrome extension

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select the `extension/` folder

### 7. Connect extension to session

After starting a session, open the extension's service worker console (`chrome://extensions` → "service worker" link) and paste:

```javascript
chrome.storage.local.set({
  session_id: "PASTE_FROM_localStorage.getItem('active_session_id')_IN_APP_TAB",
  token: "PASTE_FROM_localStorage.getItem('token')_IN_APP_TAB"
})
```

> Automatic session handshake is planned for the next release.

---

## Docker (Linux/Mac)

```bash
cp backend/.env.example backend/.env  # fill in keys
cp frontend/.env.local.example frontend/.env.local
docker compose up --build
```

On Windows, the sentence-transformers + PyTorch layer (~2.5 GB) unpacks very slowly under WSL2. Manual setup above is recommended for Windows.

---

## API reference

```
POST  /auth/register
POST  /auth/login

POST  /sessions/start     LLM expansion + embedding + session creation
POST  /sessions/end       computes completion score
GET   /sessions           session history
GET   /sessions/{id}      full session with events + state transitions

POST  /events             called by Chrome extension per page visit
WS    /ws/{session_id}    live drift score stream

GET   /metrics/summary
GET   /metrics/patterns   requires 3+ completed sessions
GET   /metrics/sessions/{id}/curve
```

Interactive docs at http://localhost:8000/docs

---

## Project structure

```
focusflow/
├── backend/
│   ├── main.py              FastAPI — all routes + WebSocket
│   ├── models.py            SQLAlchemy ORM
│   ├── schemas.py           Pydantic schemas
│   ├── database.py          DB connection + init
│   ├── auth.py              JWT + bcrypt
│   ├── intent_engine.py     LLM expansion + embedding
│   ├── drift_scorer.py      Momentum-weighted drift formula
│   ├── state_machine.py     State transitions
│   ├── content_pipeline.py  Content extractors
│   ├── tasks.py             Celery nightly aggregation
│   └── config.py            Env var management
│
├── frontend/src/
│   ├── app/                 Next.js pages
│   ├── components/          DriftGauge, DriftCurve, ContentTimeline, etc.
│   ├── lib/                 api.ts, websocket.ts
│   └── types/index.ts
│
├── extension/
│   ├── content_script.js    Captures URL + text per page
│   ├── background.js        Sends events to API
│   └── popup/
│
├── docs/screenshots/
├── docker-compose.yml
└── README.md
```

---

## License

MIT