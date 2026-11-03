from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from .config import settings


class ContentError(RuntimeError):
    pass


def _read(name: str) -> Any:
    path: Path = settings.content_path.parent / name
    if not path.exists():
        raise ContentError(f"Content file not found: {path}")
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


@lru_cache(maxsize=1)
def load_content() -> dict[str, Any]:
    modules = _read("modules.json")
    code_tasks = _read("tasks-code.json")
    theory_tasks = _read("tasks-theory.json")
    extra_code = [
        *_read("tasks-code-extra.json"),
        *_read("tasks-code-extra-functions.json"),
        *_read("tasks-code-extra-api-ui.json"),
        *_read("tasks-code-extra-ml-cv.json"),
    ]
    extra_theory = [
        *_read("tasks-theory-extra-python.json"),
        *_read("tasks-theory-extra-systems.json"),
        *_read("tasks-theory-extra-backend.json"),
        *_read("tasks-theory-extra-ai.json"),
        *_read("tasks-theory-extra-fastapi.json"),
        *_read("tasks-theory-extra-databases.json"),
        *_read("tasks-theory-extra-automation.json"),
        *_read("tasks-theory-extra-devops.json"),
        *_read("tasks-theory-extra-security.json"),
        *_read("tasks-theory-extra-data.json"),
        *_read("tasks-theory-extra-vision.json"),
        *_read("tasks-theory-extra-ml-training.json"),
        *_read("tasks-theory-extra-ml-serving.json"),
        *_read("tasks-theory-extra-exam.json"),
    ]
    exams = _read("exams.json")
    data = {
        "meta": _read("meta.json"),
        "modules": modules,
        "tasks": [*code_tasks, *theory_tasks, *extra_code, *extra_theory],
        "exams": exams,
    }
    _validate(data)
    return data


def _validate(data: dict[str, Any]) -> None:
    modules = data.get("modules")
    tasks = data.get("tasks")
    exams = data.get("exams")
    if not isinstance(modules, list) or not modules:
        raise ContentError("modules must be a non-empty list")
    if not isinstance(tasks, list):
        raise ContentError("tasks must be a list")
    if not isinstance(exams, list):
        raise ContentError("exams must be a list")

    module_slugs = [module["slug"] for module in modules]
    if len(module_slugs) != len(set(module_slugs)):
        raise ContentError("duplicate module slugs")

    task_slugs = [task["slug"] for task in tasks]
    if len(task_slugs) != len(set(task_slugs)):
        raise ContentError("duplicate task slugs")

    known_tasks = set(task_slugs)
    for module in modules:
        for lesson in module.get("lessons", []):
            for task_slug in lesson.get("task_slugs", []):
                if task_slug not in known_tasks:
                    raise ContentError(
                        f"lesson {lesson['slug']} references unknown task {task_slug}"
                    )

    for exam in exams:
        for question in exam.get("questions", []):
            if question.get("type") == "code" and question.get("task_slug"):
                if question["task_slug"] not in known_tasks:
                    raise ContentError(
                        f"exam {exam['slug']} references unknown task {question['task_slug']}"
                    )


def modules() -> list[dict[str, Any]]:
    return load_content()["modules"]


def tasks() -> list[dict[str, Any]]:
    return load_content()["tasks"]


def exams() -> list[dict[str, Any]]:
    return load_content()["exams"]


def meta() -> dict[str, Any]:
    return load_content().get("meta", {})


def module_by_slug(slug: str) -> dict[str, Any] | None:
    return next((module for module in modules() if module["slug"] == slug), None)


def task_by_slug(slug: str) -> dict[str, Any] | None:
    return next((task for task in tasks() if task["slug"] == slug), None)


def exam_by_slug(slug: str) -> dict[str, Any] | None:
    return next((exam for exam in exams() if exam["slug"] == slug), None)


def lesson_by_slug(slug: str) -> tuple[dict[str, Any], dict[str, Any]] | None:
    for module in modules():
        for lesson in module.get("lessons", []):
            if lesson["slug"] == slug:
                return module, lesson
    return None


def public_task(task: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key, value in task.items()
        if key not in {"tests", "solution"}
    }


def public_lesson(lesson: dict[str, Any]) -> dict[str, Any]:
    return lesson


def public_exam(exam: dict[str, Any]) -> dict[str, Any]:
    questions = []
    for question in exam.get("questions", []):
        item = {key: value for key, value in question.items() if key != "correct"}
        questions.append(item)
    return {**exam, "questions": questions}
