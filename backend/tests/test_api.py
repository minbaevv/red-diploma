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


def test_tests_use_isolated_database():
    from app.config import settings

    assert "red-diploma-test-" in str(settings.db_path)
    assert settings.db_path.name == "red_diploma.db"


def test_curriculum_totals():
    assert len(content.modules()) == 13
    assert len(content.tasks()) == 152
    assert len(content.module_by_slug("data-ml")["task_slugs"]) == 22
    assert [(exam["stage"], exam["points"]) for exam in content.exams()] == [
        (1, 20),
        (2, 30),
        (3, 50),
    ]


def test_every_code_solution_passes():
    code_tasks = [task for task in content.tasks() if task["type"] == "code"]
    for task in code_tasks:
        result = run_code(
            task["solution"],
            task["tests"],
            static=task.get("check_mode") == "static",
            forbidden_patterns=task.get("forbidden_patterns", []),
        )
        assert result["passed"], task["slug"]


def test_static_checker_does_not_execute_user_code():
    checks = [
        {
            "label": "transforms.Compose",
            "expr": "has('transforms\\\\.Compose')",
            "expected": True,
        }
    ]
    result = run_code(
        "import torchvision\npipeline = transforms.Compose([])",
        checks,
        static=True,
    )
    assert result["passed"] is True
    assert result["results"][0]["input"] == "transforms.Compose"

    missing = run_code("value = 1", checks, static=True)
    assert missing["passed"] is False


def test_forbidden_patterns_block_instead_of_silently_passing():
    result = run_code(
        "def minmax(values):\n    return min(values), max(values)\n",
        [],
        forbidden_patterns=[r"\bmin\s*\(", r"\bmax\s*\("],
    )
    assert result["passed"] is False
    assert result["error"] == "forbidden"
    assert "min(" in result["stderr"]


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
    assert len(code_tasks) == 54
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


def test_project_path_is_practice_only(client: TestClient):
    payload = client.get("/api/bootstrap").json()
    path = next(item for item in payload["paths"] if item["slug"] == "exam-project")
    steps = [step for section in path["sections"] for step in section["steps"]]
    assert len(steps) == 12
    assert all(step["type"] == "task" for step in steps)

    known_tasks = {task["slug"]: task for task in payload["tasks"]}
    for step in steps:
        assert step["slug"] in known_tasks
        assert known_tasks[step["slug"]]["practice_only"] is True


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


def test_drills_content_structure():
    drills = content.drills()
    assert [drill["slug"] for drill in drills] == [
        "sql",
        "linux",
        "github",
        "pandas",
        "transforms",
        "visualization",
        "fastapi",
        "python",
    ]
    counts = {drill["slug"]: len(drill["questions"]) for drill in drills}
    assert counts == {
        "sql": 30,
        "linux": 30,
        "github": 30,
        "pandas": 30,
        "transforms": 20,
        "visualization": 22,
        "fastapi": 22,
        "python": 22,
    }
    question_ids: list[str] = []
    for drill in drills:
        assert set(drill["title"]) == {"ru", "kg"}
        assert set(drill["description"]) == {"ru", "kg"}
        for question in drill["questions"]:
            question_ids.append(question["id"])
            assert set(question["prompt"]) == {"ru", "kg"}
            assert set(question["explanation"]) == {"ru", "kg"}
            assert isinstance(question["example"], str) and question["example"].strip()
            assert question["correct"] in "abcd"
            assert [option["id"] for option in question["options"]] == [
                "a",
                "b",
                "c",
                "d",
            ]
            for option in question["options"]:
                assert set(option["text"]) == {"ru", "kg"}
                assert option["text"]["ru"].strip()
                assert option["text"]["kg"].strip()
    assert len(question_ids) == 206
    assert len(question_ids) == len(set(question_ids))


def test_drills_endpoint_hides_answers(client: TestClient):
    response = client.get("/api/drills")
    assert response.status_code == 200
    summaries = response.json()
    assert len(summaries) == 8
    assert sum(item["question_count"] for item in summaries) == 206
    assert all(item["best_percent"] == 0 for item in summaries)

    detail = client.get("/api/drills/sql")
    assert detail.status_code == 200
    questions = detail.json()["drill"]["questions"]
    assert len(questions) == 30
    for question in questions:
        assert "correct" not in question
        assert "explanation" not in question
        assert "example" not in question
        assert len(question["options"]) == 4


def test_drill_check_reveals_feedback_after_answer(client: TestClient):
    question = content.drill_by_slug("sql")["questions"][0]
    correct = question["correct"]
    wrong = next(letter for letter in "abcd" if letter != correct)

    right = client.post(
        "/api/drills/sql/check",
        json={"question_id": question["id"], "option": correct},
    )
    assert right.status_code == 200
    assert right.json()["correct"] is True
    assert right.json()["correct_answer"] == correct
    assert right.json()["explanation"] == question["explanation"]
    assert right.json()["example"] == question.get("example", "")

    wrong_response = client.post(
        "/api/drills/sql/check",
        json={"question_id": question["id"], "option": wrong},
    )
    assert wrong_response.status_code == 200
    assert wrong_response.json()["correct"] is False
    assert wrong_response.json()["correct_answer"] == correct

    missing = client.post(
        "/api/drills/sql/check",
        json={"question_id": "missing", "option": correct},
    )
    assert missing.status_code == 404


def test_drill_submit_scores_and_keeps_best(client: TestClient):
    drill = content.drill_by_slug("python")
    answers = {question["id"]: question["correct"] for question in drill["questions"]}
    first = client.post("/api/drills/python/submit", json={"answers": answers})
    assert first.status_code == 200
    payload = first.json()
    assert payload["score"] == 22
    assert payload["max_score"] == 22
    assert payload["percent"] == 100
    assert payload["best_percent"] == 100
    assert len(payload["results"]) == 22
    assert all(result["correct"] for result in payload["results"])

    first_id = drill["questions"][0]["id"]
    partial = dict(answers)
    partial[first_id] = next(
        letter for letter in "abcd" if letter != drill["questions"][0]["correct"]
    )
    second = client.post("/api/drills/python/submit", json={"answers": partial})
    assert second.status_code == 200
    assert second.json()["percent"] < 100
    assert second.json()["best_percent"] == 100

    bootstrap = client.get("/api/bootstrap").json()
    summary = next(item for item in bootstrap["drills"] if item["slug"] == "python")
    assert summary["best_percent"] == 100
    assert summary["attempts"] == 2
    assert bootstrap["stats"]["drills_done"] == 1
    assert bootstrap["stats"]["total_drills"] == 8
    assert bootstrap["stats"]["drill_questions"] == 206

    attempts = client.get("/api/attempts").json()
    drill_attempts = [attempt for attempt in attempts if attempt["kind"] == "drill"]
    assert len(drill_attempts) == 2
