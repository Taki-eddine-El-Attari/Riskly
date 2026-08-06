# Riskly

Riskly is a decision-support for buyers of expired/second-hand domains used for cold-email outreach (deliverability, SEO resale, etc.). A user submits 1–5 domain names — optionally with a warm-up traffic CSV — and Riskly gathers external reputation signals, runs them through two ML models, and returns a clear verdict with an explanation:

- **Bon achat** (worth buying)
- **Risqué** (risky)
- **À éviter** (avoid)
- **Données insuffisantes** (insufficient data — e.g. a dead/parked domain the models were never trained to judge)

The React SPA (`frontend/`) talks to a FastAPI backend (`backend/app/`) over HTTP using an HttpOnly session cookie (local login or Telegram). The `analysis_service` orchestrator is the heart of the backend: it fans out to signal collectors, feeds the results through ML scoring + a rule-based decision matrix, and persists everything to PostgreSQL. Uploaded warm-up CSVs are stored on a private file volume, never in the repo or served statically.

## How it works

1. **Collect** — for each submitted domain, collectors query external sources in parallel:
   - **RDAP** (`rdap.org`) → registration date → domain age
   - **Open PageRank** → PageRank-style rank (0–10) + referring domains (backlinks)
   - **DNS resolution** → nameservers, MX/SPF/DMARC presence
   - **DNSBL blacklists** (`pydnsbl`), **PhishTank**, **URLhaus**, **OpenPhish** → consolidated threat-database flag
   - **ip-api** → hosting country / IP
   - Lexical features (length, hyphen count, TLD)
2. **Score** — two models, both explained rather than opaque:
   - A **risk model** (XGBoost) estimating malicious probability, explained with **SHAP**.
   - A **profitability / email-health model** (XGBoost) run only when a warm-up CSV is provided.
3. **Decide** — a rule-based `DecisionMatrix` combines malicious probability, SEO authority (rank + backlinks + age), and email health into a final verdict, with a **hard security veto** that overrides everything else, and an explicit "insufficient data" path for domains with no external signal at all (common for expired/parked domains).
4. **Report** — the frontend renders a verdict, score gauges, explanatory factors, transparency alerts (recent domain, no authority, discontinuous history, threat-database hit), and lets the user export a PDF/CSV report.

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 19 + Vite + TypeScript, Tailwind CSS v4, shadcn/ui, React Router, TanStack Query, Framer Motion (`motion`), jsPDF |
| Backend | FastAPI, SQLAlchemy 2, PostgreSQL, Pydantic Settings, Passlib/bcrypt, `httpx`, APScheduler, Celery (workers) |
| ML | XGBoost, scikit-learn, SHAP, pandas, joblib |
| Auth | Local (username + password) and Telegram Login Widget, both behind a signed HttpOnly session cookie |

## Project structure

```
Riskly/
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── api/v1/           # routes: auth, domains, analyses, history, warmup
│   │   ├── collectors/       # external signal collectors (RDAP, rank, blacklist, network, traffic, backlinks)
│   │   ├── core/             # config, database, security, cache, exceptions
│   │   ├── ml/                # pipeline, feature builder, predictor, explainer, model artifacts
│   │   ├── models/            # SQLAlchemy models
│   │   ├── repositories/      # DB access layer
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── services/           # analysis orchestration, decision matrix, auth, warmup storage
│   │   └── workers/            # Celery app + background tasks
│   ├── alembic/                # DB migrations
│   ├── collect_features.py     # standalone signal-collection script
│   └── requirements.txt / pyproject.toml
├── frontend/                  # React SPA
│   └── src/
│       ├── api/                # HTTP calls (auth, analyses)
│       ├── hooks/               # TanStack Query hooks
│       ├── context/              # AuthContext (session state)
│       ├── components/            # ui/ (shadcn), auth/, landing/, analysis/
│       ├── pages/                  # Landing, Login, Register, Analyze, History, ReportPage, TelegramCallback
│       └── lib/                     # api client, scores, factors, report export, warmup helpers
├── riskly-design-system/       # brand assets: logos, fonts, color palette, design tokens
├── design-system/               # standalone HTML style guides
└── TELEGRAM_LOGIN.md            # Telegram Login Widget setup guide
```

See [`frontend/ARCHITECTURE.md`](frontend/ARCHITECTURE.md) for the full frontend layer breakdown and [`frontend/design.md`](frontend/design.md) for the visual design system (tokens, typography, components, motion).

## API overview

All routes are mounted under `/api/v1`:

| Router | Prefix | Purpose |
|---|---|---|
| `auth` | `/api/v1/auth` | register, login, Telegram login, `me`, logout |
| `analyses` | `/api/v1/analyses` | create analysis (JSON or multipart with warm-up CSV), status, warm-up file CRUD |
| `domains` | `/api/v1/domains` | list/search domains, metrics, admin stats & cache |
| `analyses` (history) | `/api/v1/analyses` | paginated history, stats overview, admin listing, get/delete by id |

`GET /health` returns `{"status": "ok"}`.

## Getting started

### Prerequisites

- Python 3.11+ (backend `pyproject.toml`) — a `.venv`/`venv` is expected in `backend/`
- Node.js (for the Vite/React frontend)
- PostgreSQL

### Backend

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env   # then fill in DATABASE_URL, SECRET_KEY, API keys...
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Key environment variables (`backend/.env`, see [`.env.example`](backend/.env.example)):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SECRET_KEY` | signs the session cookie |
| `TELEGRAM_BOT_TOKEN` | enables Telegram login (empty = disabled) |
| `OPEN_PAGERANK_API_KEY` | required for rank/backlinks signals — without it, scores skew toward "missing data" |
| `CORS_ORIGINS` | comma-separated allowed frontend origins |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` | cookie flags — `true`/`none` in production over HTTPS |
| `WARMUP_STORAGE_DIR` | private, non-served directory for uploaded warm-up CSVs |

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL, and Telegram vars if using Telegram login
npm run dev
```

Frontend env vars (`frontend/.env.example`): `VITE_API_URL`, `VITE_TELEGRAM_BOT_ID`, `VITE_TELEGRAM_BOT`.

### Telegram login (optional)

Full walkthrough in [`TELEGRAM_LOGIN.md`](TELEGRAM_LOGIN.md): create a bot via **@BotFather**, register the site domain with `/setdomain` (the widget does **not** work on `localhost`), then wire the token/bot-id into the backend/frontend env files above.

## Scripts reference

| Location | Command | Effect |
|---|---|---|
| `frontend/` | `npm run dev` | start Vite dev server |
| `frontend/` | `npm run build` | typecheck + production build |
| `frontend/` | `npm run preview` | preview the production build |
| `backend/` | `uvicorn app.main:app --reload` | start the API in dev mode |

## Notes

- The backend logs collector/model results at `INFO` level to make external-API behaviour visible during development (see `app/main.py`).
- `collect_features.py` is a standalone script mirroring the collectors, useful for offline feature collection/experimentation.
- Design assets (logos, fonts, color tokens) live in `riskly-design-system/`; static HTML style guides live in `design-system/`.
