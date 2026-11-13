# Red Diploma — project guide for agents

## What this is

Bilingual (RU/KG) exam-prep app for the Motion Web backend + AI final exam.
FastAPI backend serves content and checks code; React/Vite frontend renders
lessons, practice, exams, and the guided `ml-capstone` and `exam-project` routes.

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
- `backend/app/jarvis.py` — J.A.R.V.I.S. brain: RU/KG intents, progress/next-step context, guarded code review, local Ollama for free-form RU (KG always deterministic), optional Claude Haiku 4.5 fallback, and Piper/ElevenLabs speech.
- `backend/app/config.py` — settings path resolution and the optional repo `.env` loader.
- `backend/app/db.py` — SQLite progress store (`backend/data/red_diploma.db`).
- `backend/content/*.json` — all lessons, tasks, exams, and routes.
- `backend/content/drills-*.json` — drill question banks (8 categories, 206 questions).
- `backend/tests/test_api.py` — API/content invariants.
- `backend/tests/conftest.py` — throw-away SQLite DB for tests; never touches the real progress DB.
- `frontend/src/pages/TaskPage.jsx` — theory/code practice UI and tutorial.
- `frontend/src/pages/LessonPage.jsx` — lesson reader.
- `frontend/src/pages/Drills.jsx` / `DrillPage.jsx` — drill catalog and study/exam modes.
- `frontend/src/pages/StartPage.jsx` — guided route switcher and route page.
- `frontend/src/components/PathNext.jsx` — next-step card on task pages.
- `frontend/src/components/jarvis/` — `JarvisOrb.jsx` (canvas reactor), `JarvisPanel.jsx` (three-column HUD), `voice.js` (wake word, TTS/STT, tones), `jarvis.css`.
- `frontend/src/state/JarvisContext.jsx` — panel state, chat history, page/task context registry, speech playback, wake mode.
- `frontend/src/theme.css` — dark multi-accent design system.

## Content rules

- Keep both RU and KG fields in sync. Never add a Russian-only string.
- Code tasks live in `backend/content/tasks-code*.json`; currently 54 code
  tasks (152 tasks total). Every code task needs `walkthrough`, `pitfalls`,
  and `exam_tip`. A test enforces this.
- Algorithm practice must not call built-in `min`/`max`/`sorted`/`sum` where
  the task says to write the algorithm manually. Declare `forbidden_patterns`
  (regex, e.g. `\\bmin\\s*\\(`); the runner rejects matches before execution.
- The public task payload exposes only the first two tests as `examples`.
  Keep full `tests` and `solution` hidden from the client.
- Guided routes in `paths.json`: `ml-capstone` (5 sections, 20 steps) and
  `exam-project` (6 sections, 12 practice-only project steps). Step links use
  `?path=<slug>&step=N`.
- Project tasks are marked `practice_only: true`: the frontend hides the
  tutorial block but still shows hints and examples.
- `check_mode: "static"` uses regex/substring checks for tasks whose packages
  are not installed (torch, streamlit); FastAPI, OpenCV, and pure-Python tasks
  use executable tests.
- Drills live in `drills-*.json`; every question needs RU/KG prompt, four
  options a-d, `correct`, `explanation`, and `example`. The public payload
  strips `correct`, `explanation`, and `example`.
- Drill mistakes are reviewed on the drill page and are excluded from the
  global Mistakes list.
- J.A.R.V.I.S. must never expose a task `solution` or the full hidden `tests`.
  `_task_brief()` includes only the first two examples and no solution; the LLM
  system prompt forbids full answers; `_leaks_solution()` rejects a reply that
  contains the solution. Keep all three guards.
- Task contexts (`explain`, `hint`, `review`) always use the deterministic
  local brain, never the LLM. Kyrgyz replies always use the local brain too:
  small Ollama models produce pseudo-Kyrgyz. `JARVIS_LLM` only affects
  free-form Russian chat.
- Jarvis addresses the user as «сэр» in both RU and KG (movie persona).
  «мырза» stays only in `KYRGYZ_WORDS` for input detection, never in replies.
- `load_content()` is cached with `lru_cache`: restart uvicorn after editing
  content JSON.

## Verification

- Backend: `py -3.13 -m pytest -q` (currently 34 tests).
- Frontend: `npm run build` must pass.
- UI: check desktop and mobile for horizontal overflow and console errors.
  Jarvis checks: open via `Ctrl+J`, greeting appears, orb canvas renders,
  quick commands answer, RU and KG replies work, task context sends
  `task_slug`/`code`, and no solution leaks.
- Do not claim a content/API change works from reading code alone; hit the API
  or run the test.

## Gotchas

- The code runner executes local Python and is not a sandbox. Never expose the
  app publicly without an isolated runner.
- Tests must stay isolated: `backend/tests/conftest.py` points `RED_DIPLOMA_DB`
  at a temporary SQLite file, so `pytest` never touches the real progress DB.
- `RUN_TIMEOUT_SECONDS` defaults to 5 seconds.
- On Windows, the console may mangle Cyrillic. Use `py -3 -X utf8` for scripts
  or write/read UTF-8 files directly.
- The repo remote is SSH: `git@github.com:minbaevv/red-diploma.git`.
- The optional `.env` in the repo root is loaded by `config.py`; `.env` is
  git-ignored and `.env.example` is the template. Keys are never sent to the
  frontend.
- Browser speech recognition needs Chrome/Edge and a localhost/HTTPS origin.
  Kyrgyz STT is not available in browsers: type Kyrgyz, speak Russian.
- Piper models live in `backend/models/piper/` (git-ignored, ~180 MB) and the
  backend finds `piper.exe` next to the running Python. `JARVIS_TTS=browser`
  disables backend speech; `PIPER_VOICE` forces one voice for every language.
- Ollama is probed once per 30 s. If it is down, free-form RU falls back to the
  local brain instead of waiting on a long HTTP timeout.
- Preserve user changes; check `git status` before editing or committing.
