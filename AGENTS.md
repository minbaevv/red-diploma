# Red Diploma — project guide for agents

## What this is

Bilingual (RU/KG) exam-prep app for the Motion Web backend + AI final exam.
FastAPI backend serves content and checks code; React/Vite frontend renders
lessons, practice, exams, and the guided `ml-capstone` route.

## Commands

Backend (from `backend/`):

```powershell
py -3.13 -m uvicorn app.main:app --reload
py -3.13 -m pytest -q
```

Frontend (from `frontend/`):

```powershell
npm run dev
npm run build
```

The API runs at `http://127.0.0.1:8000`; Vite proxies `/api` on `:5173`.

## Architecture map

- `backend/app/main.py` — API, content loading, code runner, static serving.
- `backend/app/db.py` — SQLite progress store (`backend/data/red_diploma.db`).
- `backend/content/*.json` — all lessons, tasks, exams, and routes.
- `backend/tests/test_api.py` — API/content invariants.
- `frontend/src/pages/TaskPage.jsx` — theory/code practice UI and tutorial.
- `frontend/src/pages/LessonPage.jsx` — lesson reader.
- `frontend/src/pages/PathPage.jsx` / `StartPage.jsx` — guided route.
- `frontend/src/theme.css` — dark multi-accent design system.

## Content rules

- Keep both RU and KG fields in sync. Never add a Russian-only string.
- Code tasks live in `backend/content/tasks-code*.json`; every code task needs
  `walkthrough`, `pitfalls`, and `exam_tip`. A test enforces this.
- The public task payload exposes only the first two tests as `examples`.
  Keep full `tests` and `solution` hidden from the client.
- Guided route `ml-capstone` has 20 steps in `paths.json`; step links use
  `?path=ml-capstone&step=N`.
- `load_content()` is cached with `lru_cache`: restart uvicorn after editing
  content JSON.

## Verification

- Backend: `py -3.13 -m pytest -q` (currently 13 tests).
- Frontend: `npm run build` must pass.
- UI: check desktop and mobile for horizontal overflow and console errors.
- Do not claim a content/API change works from reading code alone; hit the API
  or run the test.

## Gotchas

- The code runner executes local Python and is not a sandbox. Never expose the
  app publicly without an isolated runner.
- `RUN_TIMEOUT_SECONDS` defaults to 5 seconds.
- On Windows, the console may mangle Cyrillic. Use `py -3 -X utf8` for scripts
  or write/read UTF-8 files directly.
- The repo remote is SSH: `git@github.com:minbaevv/red-diploma.git`.
- Preserve user changes; check `git status` before editing or committing.
