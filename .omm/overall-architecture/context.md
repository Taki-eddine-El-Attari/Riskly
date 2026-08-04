Stack: FastAPI + SQLAlchemy 2.0 + PostgreSQL (backend), React 19 + Vite + TypeScript + Tailwind + shadcn/ui (frontend). ML: XGBoost (risk classifier + warm-up profitability classifier) with SHAP explanations, loaded from `backend/app/ml/artifacts/`.

Auth is cookie-session based (Starlette SessionMiddleware, signed HttpOnly cookie) and supports both local password login and Telegram login — no JWT is stored client-side. Analysis is synchronous over HTTP (the frontend allows up to 90s per request) rather than queued; a Celery-based async path exists only as unfinished scaffolding.
