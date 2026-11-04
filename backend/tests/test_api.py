from __future__ import annotations

from contextlib import closing

import pytest
from fastapi.testclient import TestClient

from app import content
from app.db import connect, init_db
from app.main import app
from app.runner import run_code


@pytest.fixture(autouse=True)
def clean_database():
    init_db()
    with closing(connect()) as connection, connection:
        connection.execute("DELETE FROM progress")
        connection.execute("DELETE FROM attempts")
        connection.execute("DELETE FROM notes")
        connection.execute("DELETE FROM settings")
    yield
    with closing(connect()) as connection, connection:
        connection.execute("DELETE FROM progress")
        connection.execute("DELETE FROM attempts")
        connection.execute("DELETE FROM notes")
        connection.execute("DELETE FROM settings")


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_curriculum_totals():
    assert len(content.modules()) == 13
    assert len(content.tasks()) == 140
    assert len(content.module_by_slug("data-ml")["task_slugs"]) == 22
    assert [(exam["stage"], exam["points"]) for exam in content.exams()] == [
        (1, 20),
        (2, 30),
        (3, 50),
    ]


def test_every_code_solution_passes():
    code_tasks = [task for task in content.tasks() if task["type"] == "code"]
    assert len(code_tasks) == 42
    for task in code_tasks:
        result = run_code(task["solution"], task["tests"])
        assert result["passed"], task["slug"]


def test_every_code_task_has_guided_explanation():
    code_tasks = [task for task in content.tasks() if task["type"] == "code"]
    for task in code_tasks:
        assert task.get("walkthrough"), task["slug"]
        assert task.get("pitfalls"), task["slug"]
        assert task.get("exam_tip"), task["slug"]
        assert task.get("explanation"), task["slug"]


def test_bootstrap_hides_tests_and_solutions(client: TestClient):
    response = client.get("/api/bootstrap")
    assert response.status_code == 200
    payload = response.json()
    assert payload["stats"]["exam_max"] == 100
    for task in payload["tasks"]:
        assert "tests" not in task
        assert "solution" not in task
    code_tasks = [task for task in payload["tasks"] if task["type"] == "code"]
    assert len(code_tasks) == 42
    for task in code_tasks:
        assert 1 <= len(task.get("examples", [])) <= 2, task["slug"]


def test_bootstrap_includes_valid_guided_path(client: TestClient):
    payload = client.get("/api/bootstrap").json()
    path = next(item for item in payload["paths"] if item["slug"] == "ml-capstone")
    steps = [step for section in path["sections"] for step in section["steps"]]
    assert len(steps) == 20
    assert steps[0] == {
        "type": "lesson",
        "slug": "python-core-lesson",
        "note": {
            "ru": "Переменные, списки, циклы и словари.",
            "kg": "Өзгөрмөлөр, тизмелер, циклдар жана сөздүктөр.",
        },
    }
    known_lessons = {
        lesson["slug"]
        for module in payload["modules"]
        for lesson in module["lessons"]
    }
    known_tasks = {task["slug"] for task in payload["tasks"]}
    for step in steps:
        target = known_lessons if step["type"] == "lesson" else known_tasks
        assert step["slug"] in target


def test_task_run_marks_progress(client: TestClient):
    task = content.task_by_slug("sum-even")
    response = client.post(
        "/api/tasks/sum-even/run",
        json={"code": task["solution"]},
    )
    assert response.status_code == 200
    assert response.json()["passed"] is True
    assert response.json()["stdout"] == ""

    bootstrap = client.get("/api/bootstrap").json()
    assert bootstrap["stats"]["tasks_done"] == 1
    assert bootstrap["progress"][0]["item_id"] == "sum-even"


def test_failed_retry_keeps_task_completed(client: TestClient):
    task = content.task_by_slug("sum-even")
    first = client.post("/api/tasks/sum-even/run", json={"code": task["solution"]})
    assert first.json()["passed"] is True

    retry = client.post(
        "/api/tasks/sum-even/run",
        json={"code": "def sum_even(numbers):\n    return 0"},
    )
    assert retry.json()["passed"] is False

    progress = client.get("/api/bootstrap").json()["progress"]
    record = next(item for item in progress if item["item_id"] == "sum-even")
    assert record["status"] == "done"
    assert record["score"] == task["points"]


@pytest.mark.parametrize(
    ("slug", "points"),
    [("stage-1", 20), ("stage-2", 30), ("stage-3", 50)],
)
def test_exam_submit_scores_100_percent(client: TestClient, slug: str, points: int):
    exam = content.exam_by_slug(slug)
    answers = {}
    for question in exam["questions"]:
        if question["type"] == "quiz":
            answers[question["id"]] = question["correct"]
        elif question["type"] == "code":
            task = content.task_by_slug(question["task_slug"])
            answers[question["id"]] = task["solution"]

    response = client.post(f"/api/exams/{slug}/submit", json={"answers": answers})
    assert response.status_code == 200
    payload = response.json()
    assert payload["score"] == points
    assert payload["max_score"] == points
    assert payload["percent"] == 100
    assert payload["red"] is True


def test_exam_endpoint_hides_correct_answers(client: TestClient):
    response = client.get("/api/exams/stage-1")
    assert response.status_code == 200
    for question in response.json()["exam"]["questions"]:
        assert "correct" not in question


def test_theory_completion_and_notes(client: TestClient):
    response = client.post(
        "/api/tasks/sql-select/complete",
        json={"confidence": "good"},
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True

    note = client.post(
        "/api/notes",
        json={"module_slug": "sql-databases", "title": "JOIN", "body": "LEFT JOIN keeps left rows."},
    )
    assert note.status_code == 200
    note_id = note.json()["id"]
    assert client.get("/api/notes").json()[0]["title"] == "JOIN"
    assert client.delete(f"/api/notes/{note_id}").status_code == 200


def test_settings_roundtrip(client: TestClient):
    response = client.post(
        "/api/settings",
        json={"language": "kg", "exam_date": "2026-12-15", "student_name": "Aibek"},
    )
    assert response.status_code == 200
    assert response.json() == {
        "language": "kg",
        "exam_date": "2026-12-15",
        "student_name": "Aibek",
    }
