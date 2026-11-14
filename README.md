# Красный диплом / Кызыл диплом

Bilingual (RU/KG) exam cockpit for the Motion Web backend + AI final exam. It combines short lessons, code and theory practice, three staged mock exams, hints, mistake review, and a 100-point readiness score in a dark, multi-accent interface.

## What is inside

- **13 modules**: Python core, functions, SQL, Linux/Git, backend/API, ML/data, computer vision, LLM/RAG/Streamlit, FastAPI/Pydantic, databases/ORM, automation/LLM, DevOps/security, exam tactics.
- **152 tasks**: 54 code tasks checked by tests and 98 theory tasks with model answers, follow-up questions, walkthroughs, pitfalls, and exam tips. Every code task starts with a **practice walkthrough**: worked examples, the core idea, a step-by-step plan, a common mistake, and an exam tip before the editor. The capstone path covers `def` functions, ML training, model compression, FastAPI serving, Streamlit UI, MediaPipe gestures, and GitHub artifacts; the project path rebuilds the Flowers CNN, both FastAPI services, Streamlit, and OpenCV in small code chunks.
- **Guided start**: `/start` switches between a 20-step `ml-capstone` route from Python to a deployed ML service and a 12-step `exam-project` route that rebuilds the exam project in small code chunks. Every completed lesson or task shows a **Continue** button that opens the next step with `?path=<slug>&step=N`.
- **3 exams**: stage 1 (20 points), stage 2 (30 points), stage 3 (50 points). A total of 80+ is the red-diploma target.
- **Bilingual UI and content** with RU/KG switching.
- **J.A.R.V.I.S. command center**: an animated cyan HUD with a canvas arc-reactor orb, voice input on the wake word «Джарвис», spoken replies, RU/KG dialogue, live task context, code review without spoilers, progress telemetry, and a next-step rail.
- **Local progress** in SQLite: completed lessons/tasks, attempts, best exam scores, notes, settings.

## Stack

- Backend: FastAPI, SQLite, subprocess-based Python test runner.
- Frontend: React 18, Vite 6, React Router, CodeMirror, React Markdown, Lucide, Fontsource variable fonts.

## Quick start

### Backend

```powershell
cd backend
py -3.13 -m pip install -r requirements.txt
py -3.13 -m uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000`; API docs are at `http://127.0.0.1:8000/api/docs`.

### Frontend development

```powershell
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to the backend on port 8000.

### Production build

```powershell
cd frontend
npm run build
```

Then start the backend normally. FastAPI serves `frontend/dist` and supports client-side routes.

## Guided start

Open `/start` (or **Старт** in the sidebar) to follow the `ml-capstone` route:

1. Python basics and `def` practice.
2. MNIST download with `torchvision`, batching, augmentation, training, metrics, compression.
3. FastAPI `/health` and `/predict`.
4. Streamlit uploader that calls the API.
5. GitHub artifacts, README, and a final runbook.

The second route, `exam-project`, is pure practice: unzip → transforms/loaders → honest split → `FlowerCNN` → training → evaluation/save → FastAPI Flowers → FastAPI MNIST → Streamlit → OpenCV preprocess → webcam. Its tasks are marked `practice_only`, so the tutorial block is hidden while hints and examples stay available.

The route is stored in `backend/content/paths.json` and returned by `/api/bootstrap`. The current step is highlighted, and lesson/task pages show a **Continue** card after completion. The URL keeps the route context in `?path=<slug>&step=N`, so the next button works without going back to the task list.

## Capstone path: model → API → UI

The `data-ml` capstone lesson and the `tasks-theory-extra-ml-*` banks walk through the complete project:

1. Train an MNIST classifier in Google Colab or locally and save `model.pth`.
2. Evaluate on validation/test and write `metrics.json`.
3. Compress the model with dynamic quantization, TorchScript, or ONNX.
4. Serve it with FastAPI (`/health`, `/predict`, `UploadFile`).
5. Build the Streamlit uploader and call the API with `requests`.
6. Add the MediaPipe/OpenCV rock-paper-scissors project as a second CV demo.
7. Publish code with Git, weights with Git LFS or GitHub Release, and secrets outside Git.

Optional capstone dependencies (use a separate Python 3.11/3.12 environment for MediaPipe):

```powershell
py -3.11 -m pip install -r requirements-capstone.txt
```

The theory tasks contain complete copy-ready code for `train.py`, `app.py`, and `streamlit_app.py`.

## J.A.R.V.I.S. command center

Open it from the cyan **J.A.R.V.I.S.** item in the sidebar, the floating orb button, or `Ctrl+J`. The panel is a three-column command center: system readiness and module status on the left, the orb + dialogue in the center, quick commands, the next route step, and protocol status on the right.

What Jarvis can do:

- **Explain a task** — the core idea, a short plan, pitfalls, and the exam tip, using the live task context.
- **Give a hint** — one step at a time, without revealing the solution or hidden tests.
- **Review code** — syntax errors, forbidden constructs, TODO/pass, `except:`, `== None`, and failed tests; the full solution is never returned.
- **Report progress** — readiness, lessons, tasks, exam points, drills, and the next unfinished route step with a direct link.
- **Speak RU/KG** — replies follow the language of the message; the toolbar switches the whole app RU/KG. Jarvis addresses the user as **«сэр»** in both languages, as in the films.

Voice input uses the Web Speech API. Click the mic to start a hands-free voice chat: speak, Jarvis replies, and the mic reopens automatically for the next turn, like ChatGPT voice mode. Enable **«Джарвис» mode** to keep the wake word armed; «Джарвис», «привет, Джарвис», «Джарвис, привет», and «салам, Джарвис» all start the same voice chat. Chrome/Edge provide speech recognition; browsers without it still support text input. Kyrgyz speech recognition is not available in browsers, so type Kyrgyz questions — Jarvis answers in Kyrgyz.

Replies are spoken by local **Piper** voices by default: `en_GB-jarvis-high` (the movie-style British JARVIS) for English and `ru_RU-dmitri-medium` for Russian. The English voice is English-only: keep `PIPER_VOICE_RU` on the Russian voice, otherwise Russian text is read with English pronunciation. Kyrgyz has no Piper voice, so the client falls back to browser speech. Speech is generated on the backend, so the browser only receives WAV audio.

Free-form Russian conversation runs on local **Ollama** (`qwen2.5:3b` by default) when the Ollama server is up. Kyrgyz always stays on the deterministic local brain: a 3B model produces pseudo-Kyrgyz, while the hand-written KG replies are correct. Claude Haiku 4.5 and ElevenLabs remain optional cloud fallbacks. Task explanations, hints, and code review stay deterministic and never expose solutions, whichever provider is active.

One-time local setup:

```powershell
py -3.13 -m pip install piper-tts
ollama pull qwen2.5:3b

New-Item -ItemType Directory -Force backend/models/piper
curl.exe -L -o backend/models/piper/en_GB-jarvis-high.onnx `
  "https://huggingface.co/jgkawell/jarvis/resolve/main/en/en_GB/jarvis/high/jarvis-high.onnx"
curl.exe -L -o backend/models/piper/en_GB-jarvis-high.onnx.json `
  "https://huggingface.co/jgkawell/jarvis/resolve/main/en/en_GB/jarvis/high/jarvis-high.onnx.json"
curl.exe -L -o backend/models/piper/ru_RU-dmitri-medium.onnx `
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/dmitri/medium/ru_RU-dmitri-medium.onnx"
curl.exe -L -o backend/models/piper/ru_RU-dmitri-medium.onnx.json `
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/dmitri/medium/ru_RU-dmitri-medium.onnx.json"
```

Model binaries stay in `backend/models/` and are git-ignored. Copy `.env.example` to `.env` to override providers (`JARVIS_LLM=auto|ollama|anthropic|local`, `JARVIS_TTS=auto|piper|elevenlabs|browser`), voice paths, or to add cloud keys. `PIPER_VOICE` forces one voice for every language; only use it with a voice that matches the language, never to read Russian with the English movie-JARVIS.

Jarvis endpoints: `GET /api/jarvis/config`, `POST /api/jarvis/chat`, `POST /api/jarvis/speech`. Speech returns `503` when no provider supports the requested language, and the client falls back to the browser voice.

## Tests

```powershell
cd backend
py -3.13 -m pytest -q
```

## Content

Content is split across `backend/content/`:

- `meta.json` — exam date and scoring thresholds
- `modules.json` — modules, lessons, and task references
- `tasks-code.json` — code prompts, starter code, tests, solutions
- `tasks-code-extra.json` — additional code practice
- `tasks-theory.json` — theory prompts and model answers
- `tasks-theory-extra-python.json`, `tasks-theory-extra-systems.json`, `tasks-theory-extra-backend.json`, `tasks-theory-extra-ai.json` — expanded theory practice
- `tasks-theory-extra-fastapi.json`, `tasks-theory-extra-databases.json`, `tasks-theory-extra-automation.json`, `tasks-theory-extra-devops.json`, `tasks-theory-extra-security.json`, `tasks-theory-extra-data.json`, `tasks-theory-extra-vision.json` — resume-stack theory banks
- `tasks-code-extra-functions.json` — beginner `def` practice: defaults, loops, recursion, binary search, memoization
- `tasks-code-extra-api-ui.json` — FastAPI, Pydantic, UploadFile, and Streamlit client helpers
- `tasks-code-extra-ml-cv.json` — train/val split, accuracy, min-max, MediaPipe landmarks, RPS gesture, nearest resize
- `tasks-code-extra-ml-data.json` — DataLoader batch planning, confusion matrix, precision/recall
- `tasks-theory-extra-ml-training.json` — Colab MNIST training and model compression
- `tasks-theory-extra-ml-serving.json` — FastAPI serving, Streamlit client, MediaPipe RPS pipeline, Git/GitHub artifacts
- `tasks-theory-extra-ml-capstone.json` — torchvision dataset download, PIL inference, safe augmentation, full capstone runbook
- `paths.json` — guided learning routes and their ordered lesson/task steps
- `tasks-theory-extra-exam.json` — exam tactics theory
- `exams.json` — staged exams

Edit these files and restart the backend to reload content.

## Notes

- Progress is stored in `backend/data/red_diploma.db`. Set `RED_DIPLOMA_DB` to use another path.
- The code runner is intentionally local and is **not** a security sandbox. Do not expose this app to untrusted users or the public internet without replacing it with an isolated execution service.
- `RUN_TIMEOUT_SECONDS` controls the per-run timeout (default `5`).
- The default exam date is `2026-12-01`; change it in the app settings or in `meta.json`.
