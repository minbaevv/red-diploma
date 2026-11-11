from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import content
from .config import settings
from .db import (
    best_drill_scores,
    best_scores,
    create_note,
    delete_note,
    get_setting,
    init_db,
    list_attempts,
    list_notes,
    list_progress,
    record_attempt,
    set_setting,
    upsert_progress,
)
from .runner import run_code

@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Red Diploma",
    description="Bilingual exam cockpit for backend and AI.",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    code: str = Field(min_length=1, max_length=40_000)


class CompleteRequest(BaseModel):
    confidence: str = Field(default="good", pattern="^(again|hard|good|easy)$")


class ExamSubmitRequest(BaseModel):
    answers: dict[str, Any] = Field(default_factory=dict)


class DrillCheckRequest(BaseModel):
    question_id: str = Field(min_length=1, max_length=64)
    option: str = Field(pattern="^[abcd]$")


class DrillSubmitRequest(BaseModel):
    answers: dict[str, str] = Field(default_factory=dict)


class SettingsRequest(BaseModel):
    language: str | None = Field(default=None, pattern="^(ru|kg)$")
    exam_date: str | None = None
    student_name: str | None = Field(default=None, max_length=60)


class NoteRequest(BaseModel):
    module_slug: str = ""
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=8000)


def _task_public(task: dict[str, Any]) -> dict[str, Any]:
    public = {
        key: value
        for key, value in task.items()
        if key not in {"tests", "solution"}
    }
    if task.get("tests"):
        public["examples"] = [
            {
                "input": item.get("label") or item.get("input", ""),
                "expected": item.get("expected"),
            }
            for item in task["tests"][:2]
        ]
    return public


def _module_summary(module: dict[str, Any]) -> dict[str, Any]:
    return {
        "slug": module["slug"],
        "order": module.get("order", 0),
        "track": module.get("track", "backend"),
        "icon": module.get("icon", "book"),
        "accent": module.get("accent", "#E63946"),
        "title": module["title"],
        "subtitle": module["subtitle"],
        "estimated_minutes": module.get("estimated_minutes", 60),
        "lesson_count": len(module.get("lessons", [])),
        "task_count": len(module.get("task_slugs", [])),
        "task_slugs": module.get("task_slugs", []),
        "lessons": [
            {
                "slug": lesson["slug"],
                "title": lesson["title"],
                "summary": lesson.get("summary", {"ru": "", "kg": ""}),
                "minutes": lesson.get("minutes", 10),
                "task_slugs": lesson.get("task_slugs", []),
            }
            for lesson in module.get("lessons", [])
        ],
    }


def _drill_summary(
    drill: dict[str, Any], scores: dict[str, dict[str, float]]
) -> dict[str, Any]:
    record = scores.get(drill["slug"], {})
    return {
        "slug": drill["slug"],
        "order": drill.get("order", 0),
        "icon": drill.get("icon", "book"),
        "accent": drill.get("accent", "#E63946"),
        "title": drill["title"],
        "description": drill.get("description", {"ru": "", "kg": ""}),
        "minutes": drill.get("minutes", 20),
        "question_count": len(drill.get("questions", [])),
        "best_percent": record.get("best_percent", 0),
        "attempts": record.get("attempts", 0),
    }


def _progress_map() -> dict[str, dict[str, Any]]:
    return {
        f"{item['item_type']}:{item['item_id']}": item for item in list_progress()
    }


def _stats(progress: dict[str, dict[str, Any]], exams: list[dict[str, Any]]) -> dict[str, Any]:
    total_lessons = sum(len(module.get("lessons", [])) for module in content.modules())
    total_tasks = len(content.tasks())
    lessons_done = len(
        [item for item in progress.values() if item["item_type"] == "lesson"]
    )
    tasks_done = len(
        [
            item
            for item in progress.values()
            if item["item_type"] == "task" and item["status"] == "done"
        ]
    )
    best = best_scores()
    exam_points = sum(best.get(exam["slug"], 0) for exam in exams)
    exam_max = sum(float(exam.get("points", 0)) for exam in exams)
    drill_scores = best_drill_scores()
    drills = content.drills()
    drills_done = len([drill for drill in drills if drill["slug"] in drill_scores])
    drill_questions = sum(len(drill.get("questions", [])) for drill in drills)
    drill_average = (
        round(
            sum(
                drill_scores.get(drill["slug"], {}).get("best_percent", 0)
                for drill in drills
            )
            / len(drills)
        )
        if drills
        else 0
    )
    lesson_ratio = lessons_done / total_lessons if total_lessons else 0
    task_ratio = tasks_done / total_tasks if total_tasks else 0
    exam_ratio = exam_points / exam_max if exam_max else 0
    readiness = round(lesson_ratio * 25 + task_ratio * 35 + exam_ratio * 40)
    return {
        "lessons_done": lessons_done,
        "total_lessons": total_lessons,
        "tasks_done": tasks_done,
        "total_tasks": total_tasks,
        "exam_points": round(exam_points, 1),
        "exam_max": exam_max,
        "readiness": min(100, readiness),
        "red": exam_points >= 80,
        "drills_done": drills_done,
        "total_drills": len(drills),
        "drill_questions": drill_questions,
        "drill_average": drill_average,
    }


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "Red Diploma"}


@app.get("/api/bootstrap")
def bootstrap() -> dict[str, Any]:
    progress = _progress_map()
    exams = content.exams()
    best = best_scores()
    drill_scores = best_drill_scores()
    modules = [_module_summary(module) for module in content.modules()]
    tasks = [_task_public(task) for task in content.tasks()]
    exam_summaries = [
        {
            "slug": exam["slug"],
            "title": exam["title"],
            "stage": exam["stage"],
            "points": exam["points"],
            "minutes": exam["minutes"],
            "description": exam.get("description", {"ru": "", "kg": ""}),
            "question_count": len(exam.get("questions", [])),
            "best_score": best.get(exam["slug"], 0),
        }
        for exam in exams
    ]
    drill_summaries = [
        _drill_summary(drill, drill_scores) for drill in content.drills()
    ]
    return {
        "meta": content.meta(),
        "modules": modules,
        "tasks": tasks,
        "exams": exam_summaries,
        "drills": drill_summaries,
        "paths": content.paths(),
        "progress": list(progress.values()),
        "attempts": list_attempts(30),
        "notes": list_notes(),
        "settings": {
            "language": get_setting("language", "ru"),
            "exam_date": get_setting("exam_date", content.meta().get("exam_date", "")),
            "student_name": get_setting("student_name", "Student"),
        },
        "stats": _stats(progress, exams),
    }


@app.get("/api/modules/{slug}")
def module_detail(slug: str) -> dict[str, Any]:
    module = content.module_by_slug(slug)
    if module is None:
        raise HTTPException(status_code=404, detail="Module not found")
    task_slugs = set(module.get("task_slugs", []))
    tasks = [
        _task_public(task) for task in content.tasks() if task["slug"] in task_slugs
    ]
    return {
        "module": module,
        "tasks": tasks,
        "progress": list(_progress_map().values()),
    }


@app.get("/api/lessons/{slug}")
def lesson_detail(slug: str) -> dict[str, Any]:
    found = content.lesson_by_slug(slug)
    if found is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    module, lesson = found
    tasks = [
        _task_public(task)
        for task in content.tasks()
        if task["slug"] in lesson.get("task_slugs", [])
    ]
    return {"module": _module_summary(module), "lesson": lesson, "tasks": tasks}


@app.get("/api/tasks/{slug}")
def task_detail(slug: str) -> dict[str, Any]:
    task = content.task_by_slug(slug)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"task": _task_public(task)}


@app.post("/api/tasks/{slug}/run")
def task_run(slug: str, payload: RunRequest) -> dict[str, Any]:
    task = content.task_by_slug(slug)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.get("type") != "code":
        raise HTTPException(status_code=400, detail="This task is not a code task")

    result = run_code(
        payload.code,
        task.get("tests", []),
        static=task.get("check_mode") == "static",
        forbidden_patterns=task.get("forbidden_patterns", []),
    )
    score = float(task.get("points", 0)) if result["passed"] else 0
    record_attempt(
        kind="task",
        ref=slug,
        score=score,
        max_score=float(task.get("points", 0)),
        details={"passed": result["passed"], "results": result["results"]},
    )
    if result["passed"]:
        upsert_progress("task", slug, "done", score, increment_attempts=True)
    else:
        upsert_progress("task", slug, "attempted", score, increment_attempts=True)
    return {
        **result,
        "score": score,
        "max_score": task.get("points", 0),
        "explanation": task.get("explanation", {"ru": "", "kg": ""}),
    }


@app.get("/api/tasks/{slug}/solution")
def task_solution(slug: str) -> dict[str, Any]:
    task = content.task_by_slug(slug)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return {
        "solution": task.get("solution", ""),
        "explanation": task.get("explanation", {"ru": "", "kg": ""}),
    }


@app.post("/api/tasks/{slug}/complete")
def task_complete(slug: str, payload: CompleteRequest) -> dict[str, Any]:
    task = content.task_by_slug(slug)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    score = float(task.get("points", 0))
    upsert_progress("task", slug, "done", score, increment_attempts=True)
    record_attempt(
        kind="theory",
        ref=slug,
        score=score,
        max_score=score,
        details={"confidence": payload.confidence},
    )
    return {"ok": True, "score": score}


@app.post("/api/lessons/{slug}/complete")
def lesson_complete(slug: str) -> dict[str, Any]:
    found = content.lesson_by_slug(slug)
    if found is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    _, lesson = found
    upsert_progress("lesson", slug, "done", 100)
    return {"ok": True, "lesson": lesson["slug"]}


@app.get("/api/exams")
def exam_list() -> list[dict[str, Any]]:
    best = best_scores()
    return [
        {
            "slug": exam["slug"],
            "title": exam["title"],
            "stage": exam["stage"],
            "points": exam["points"],
            "minutes": exam["minutes"],
            "description": exam.get("description", {"ru": "", "kg": ""}),
            "question_count": len(exam.get("questions", [])),
            "best_score": best.get(exam["slug"], 0),
        }
        for exam in content.exams()
    ]


@app.get("/api/exams/{slug}")
def exam_detail(slug: str) -> dict[str, Any]:
    exam = content.exam_by_slug(slug)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    return {"exam": content.public_exam(exam)}


@app.post("/api/exams/{slug}/submit")
def exam_submit(slug: str, payload: ExamSubmitRequest) -> dict[str, Any]:
    exam = content.exam_by_slug(slug)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")

    total = 0.0
    max_score = 0.0
    results: list[dict[str, Any]] = []
    for question in exam.get("questions", []):
        question_id = question["id"]
        points = float(question.get("points", 0))
        max_score += points
        answer = payload.answers.get(question_id)
        if question.get("type") == "quiz":
            correct = answer == question.get("correct")
            earned = points if correct else 0
            total += earned
            results.append(
                {
                    "id": question_id,
                    "type": "quiz",
                    "correct": correct,
                    "earned": earned,
                    "max": points,
                    "correct_answer": question.get("correct"),
                    "explanation": question.get("explanation", {"ru": "", "kg": ""}),
                }
            )
        elif question.get("type") == "code":
            task = content.task_by_slug(question.get("task_slug", ""))
            if task is None:
                results.append(
                    {
                        "id": question_id,
                        "type": "code",
                        "correct": False,
                        "earned": 0,
                        "max": points,
                        "error": "task_missing",
                    }
                )
                continue
            code = str(answer or question.get("starter_code", ""))
            run = run_code(
                code,
                task.get("tests", []),
                static=task.get("check_mode") == "static",
                forbidden_patterns=task.get("forbidden_patterns", []),
            )
            earned = points if run["passed"] else 0
            total += earned
            results.append(
                {
                    "id": question_id,
                    "type": "code",
                    "correct": run["passed"],
                    "earned": earned,
                    "max": points,
                    "run": run,
                    "solution": task.get("solution", ""),
                }
            )
        else:
            results.append(
                {
                    "id": question_id,
                    "type": question.get("type", "unknown"),
                    "correct": False,
                    "earned": 0,
                    "max": points,
                    "model_answer": question.get("model_answer", {"ru": "", "kg": ""}),
                }
            )

    percent = round(total / max_score * 100) if max_score else 0
    record_attempt(
        kind="exam",
        ref=slug,
        score=total,
        max_score=max_score,
        details={"percent": percent, "results": results},
    )
    upsert_progress("exam", slug, "done", total)
    return {
        "score": total,
        "max_score": max_score,
        "percent": percent,
        "red": percent >= 80,
        "results": results,
    }


@app.get("/api/drills")
def drill_list() -> list[dict[str, Any]]:
    scores = best_drill_scores()
    return [_drill_summary(drill, scores) for drill in content.drills()]


@app.get("/api/drills/{slug}")
def drill_detail(slug: str) -> dict[str, Any]:
    drill = content.drill_by_slug(slug)
    if drill is None:
        raise HTTPException(status_code=404, detail="Drill not found")
    return {"drill": content.public_drill(drill)}


@app.post("/api/drills/{slug}/check")
def drill_check(slug: str, payload: DrillCheckRequest) -> dict[str, Any]:
    found = content.drill_question(slug, payload.question_id)
    if found is None:
        raise HTTPException(status_code=404, detail="Drill question not found")
    _, question = found
    return {
        "id": question["id"],
        "correct": payload.option == question["correct"],
        "selected": payload.option,
        "correct_answer": question["correct"],
        "explanation": question.get("explanation", {"ru": "", "kg": ""}),
        "example": question.get("example", ""),
    }


@app.post("/api/drills/{slug}/submit")
def drill_submit(slug: str, payload: DrillSubmitRequest) -> dict[str, Any]:
    drill = content.drill_by_slug(slug)
    if drill is None:
        raise HTTPException(status_code=404, detail="Drill not found")

    questions = drill.get("questions", [])
    correct_count = 0
    results: list[dict[str, Any]] = []
    for question in questions:
        selected = payload.answers.get(question["id"])
        correct = selected == question["correct"]
        if correct:
            correct_count += 1
        results.append(
            {
                "id": question["id"],
                "prompt": question.get("prompt", {"ru": "", "kg": ""}),
                "selected": selected,
                "correct": correct,
                "correct_answer": question["correct"],
                "explanation": question.get("explanation", {"ru": "", "kg": ""}),
                "example": question.get("example", ""),
            }
        )

    total = len(questions)
    percent = round(correct_count / total * 100) if total else 0
    upsert_progress("drill", slug, "done", percent, increment_attempts=True)
    record_attempt(
        kind="drill",
        ref=slug,
        score=correct_count,
        max_score=total,
        details={
            "percent": percent,
            "correct_count": correct_count,
            "total": total,
            "results": [
                {
                    "id": result["id"],
                    "correct": result["correct"],
                    "selected": result["selected"],
                }
                for result in results
            ],
        },
    )
    best = best_drill_scores().get(slug, {})
    return {
        "score": correct_count,
        "max_score": total,
        "percent": percent,
        "best_percent": best.get("best_percent", percent),
        "attempts": best.get("attempts", 1),
        "results": results,
    }


@app.get("/api/attempts")
def attempts() -> list[dict[str, Any]]:
    return list_attempts(100)


@app.post("/api/settings")
def update_settings(payload: SettingsRequest) -> dict[str, Any]:
    if payload.language is not None:
        set_setting("language", payload.language)
    if payload.exam_date is not None:
        set_setting("exam_date", payload.exam_date)
    if payload.student_name is not None:
        set_setting("student_name", payload.student_name)
    return {
        "language": get_setting("language", "ru"),
        "exam_date": get_setting("exam_date", content.meta().get("exam_date", "")),
        "student_name": get_setting("student_name", "Student"),
    }


@app.get("/api/notes")
def notes() -> list[dict[str, Any]]:
    return list_notes()


@app.post("/api/notes")
def add_note(payload: NoteRequest) -> dict[str, Any]:
    return create_note(payload.module_slug, payload.title, payload.body)


@app.delete("/api/notes/{note_id}")
def remove_note(note_id: str) -> dict[str, Any]:
    if not delete_note(note_id):
        raise HTTPException(status_code=404, detail="Note not found")
    return {"ok": True}


def _mount_frontend() -> None:
    dist = settings.frontend_dist
    if not dist.exists():
        @app.get("/")
        def missing_frontend() -> JSONResponse:
            return JSONResponse(
                {
                    "message": "Frontend is not built yet.",
                    "next": "cd frontend && npm install && npm run build",
                }
            )
        return

    assets = dist / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str) -> FileResponse:
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = dist / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(dist / "index.html")


_mount_frontend()
