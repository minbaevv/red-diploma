from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from .config import settings

RESULT_MARKER = "__RED_DIPLOMA_RESULT__"
MAX_CODE_BYTES = 40_000


def run_code(
    code: str,
    tests: list[dict[str, Any]],
    *,
    static: bool = False,
    forbidden_patterns: list[str] | None = None,
) -> dict[str, Any]:
    if len(code.encode("utf-8")) > MAX_CODE_BYTES:
        return {
            "passed": False,
            "results": [],
            "stdout": "",
            "stderr": "Код слишком длинный. Максимум 40 КБ.",
            "error": "code_too_long",
        }

    hits = _forbidden_hits(code, forbidden_patterns or [])
    if hits:
        return {
            "passed": False,
            "results": [
                {
                    "ok": False,
                    "input": "запрещённая конструкция",
                    "expected": "без " + ", ".join(forbidden_patterns or []),
                    "actual": ", ".join(hits),
                }
            ],
            "stdout": "",
            "stderr": "В этом задании нельзя использовать: " + ", ".join(hits),
            "error": "forbidden",
        }

    if static:
        return _run_static(code, tests)

    harness = _build_harness(code, tests)
    with tempfile.TemporaryDirectory(prefix="red-diploma-") as directory:
        path = Path(directory) / "solution.py"
        path.write_text(harness, encoding="utf-8")
        try:
            completed = subprocess.run(
                [sys.executable, "-I", "-B", "-X", "utf8", str(path)],
                cwd=directory,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=settings.run_timeout_seconds,
                check=False,
            )
        except subprocess.TimeoutExpired:
            return {
                "passed": False,
                "results": [],
                "stdout": "",
                "stderr": f"Превышено время выполнения ({settings.run_timeout_seconds} сек).",
                "error": "timeout",
            }

    stdout = completed.stdout or ""
    stderr = completed.stderr or ""
    results: list[dict[str, Any]] = []
    for line in stdout.splitlines():
        if line.startswith(RESULT_MARKER):
            try:
                results = json.loads(line[len(RESULT_MARKER) :])
            except json.JSONDecodeError:
                results = []
            break

    visible_stdout = "\n".join(
        line for line in stdout.splitlines() if not line.startswith(RESULT_MARKER)
    )
    if not results:
        return {
            "passed": False,
            "results": [],
            "stdout": _truncate(visible_stdout),
            "stderr": _truncate(stderr or "Тесты не запустились. Проверь синтаксис."),
            "error": "no_result",
        }

    return {
        "passed": all(item.get("ok") for item in results),
        "results": results,
        "stdout": _truncate(visible_stdout),
        "stderr": _truncate(stderr),
        "error": None,
    }


def _forbidden_hits(code: str, patterns: list[str]) -> list[str]:
    hits: list[str] = []
    for pattern in patterns:
        match = re.search(pattern, code, re.MULTILINE)
        if match:
            hits.append(match.group(0).strip())
    return hits


def _run_static(code: str, tests: list[dict[str, Any]]) -> dict[str, Any]:
    def has(pattern: str) -> bool:
        return re.search(pattern, code, re.MULTILINE) is not None

    def count(pattern: str) -> int:
        return len(re.findall(pattern, code, re.MULTILINE))

    environment = {
        "_source": code,
        "re": re,
        "has": has,
        "count": count,
    }
    results: list[dict[str, Any]] = []
    for case in tests:
        expression = case.get("expr", "")
        label = case.get("label") or expression
        try:
            value = eval(expression, environment)  # noqa: S307 - trusted content
            results.append(
                {
                    "ok": value == case.get("expected"),
                    "input": label,
                    "expected": case.get("expected"),
                    "actual": value,
                }
            )
        except Exception as exc:  # noqa: BLE001 - report to the learner
            results.append(
                {
                    "ok": False,
                    "input": label,
                    "expected": case.get("expected"),
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )

    return {
        "passed": all(item.get("ok") for item in results),
        "results": results,
        "stdout": "",
        "stderr": "",
        "error": None,
    }


def _build_harness(code: str, tests: list[dict[str, Any]]) -> str:
    cases = json.dumps(tests, ensure_ascii=False)
    return f"""
import json

{code}

_cases = json.loads({cases!r})
_results = []
for _case in _cases:
    try:
        _value = eval(_case["input"], globals())
        _actual = json.loads(json.dumps(_value, ensure_ascii=False, default=str))
        _ok = _actual == _case["expected"]
        _results.append({{
            "ok": _ok,
            "input": _case["input"],
            "expected": _case["expected"],
            "actual": _value,
        }})
    except Exception as _exc:
        _results.append({{
            "ok": False,
            "input": _case["input"],
            "expected": _case["expected"],
            "error": f"{{type(_exc).__name__}}: {{_exc}}",
        }})

print("{RESULT_MARKER}" + json.dumps(_results, ensure_ascii=False, default=str))
"""


def _truncate(value: str, limit: int = 5000) -> str:
    if len(value) <= limit:
        return value
    return value[:limit] + "\n… обрезано"
