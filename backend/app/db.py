from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import closing
from datetime import datetime, timezone
from typing import Any

from .config import settings


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(settings.db_path, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    return connection


def init_db() -> None:
    with closing(connect()) as connection, connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS progress (
                item_type TEXT NOT NULL,
                item_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'done',
                score REAL NOT NULL DEFAULT 0,
                attempts INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (item_type, item_id)
            );

            CREATE TABLE IF NOT EXISTS attempts (
                id TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                ref TEXT NOT NULL,
                score REAL NOT NULL DEFAULT 0,
                max_score REAL NOT NULL DEFAULT 0,
                details_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                module_slug TEXT NOT NULL DEFAULT '',
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """
        )


def get_setting(key: str, default: str = "") -> str:
    with closing(connect()) as connection:
        row = connection.execute(
            "SELECT value FROM settings WHERE key = ?", (key,)
        ).fetchone()
    return row["value"] if row else default


def set_setting(key: str, value: str) -> None:
    with closing(connect()) as connection, connection:
        connection.execute(
            """
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (key, value),
        )


def list_progress() -> list[dict[str, Any]]:
    with closing(connect()) as connection:
        rows = connection.execute(
            "SELECT * FROM progress ORDER BY updated_at DESC"
        ).fetchall()
    return [dict(row) for row in rows]


def upsert_progress(
    item_type: str,
    item_id: str,
    status: str = "done",
    score: float = 0,
    increment_attempts: bool = False,
) -> None:
    now = utc_now()
    with closing(connect()) as connection, connection:
        connection.execute(
            """
            INSERT INTO progress (item_type, item_id, status, score, attempts, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(item_type, item_id) DO UPDATE SET
                status = CASE WHEN progress.status = 'done' THEN 'done' ELSE excluded.status END,
                score = MAX(progress.score, excluded.score),
                attempts = progress.attempts + ?,
                updated_at = excluded.updated_at
            """,
            (
                item_type,
                item_id,
                status,
                score,
                1 if increment_attempts else 0,
                now,
                1 if increment_attempts else 0,
            ),
        )


def record_attempt(
    kind: str,
    ref: str,
    score: float,
    max_score: float,
    details: dict[str, Any],
) -> str:
    attempt_id = uuid.uuid4().hex
    with closing(connect()) as connection, connection:
        connection.execute(
            """
            INSERT INTO attempts (id, kind, ref, score, max_score, details_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                attempt_id,
                kind,
                ref,
                score,
                max_score,
                json.dumps(details, ensure_ascii=False),
                utc_now(),
            ),
        )
    return attempt_id


def list_attempts(limit: int = 50) -> list[dict[str, Any]]:
    with closing(connect()) as connection:
        rows = connection.execute(
            "SELECT * FROM attempts ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    result = []
    for row in rows:
        item = dict(row)
        item["details"] = json.loads(item.pop("details_json") or "{}")
        result.append(item)
    return result


def best_scores() -> dict[str, float]:
    with closing(connect()) as connection:
        rows = connection.execute(
            """
            SELECT ref, MAX(score) AS best
            FROM attempts
            WHERE kind = 'exam'
            GROUP BY ref
            """
        ).fetchall()
    return {row["ref"]: float(row["best"] or 0) for row in rows}


def best_drill_scores() -> dict[str, dict[str, float]]:
    with closing(connect()) as connection:
        rows = connection.execute(
            """
            SELECT item_id, score, attempts
            FROM progress
            WHERE item_type = 'drill'
            """
        ).fetchall()
    return {
        row["item_id"]: {
            "best_percent": float(row["score"] or 0),
            "attempts": int(row["attempts"] or 0),
        }
        for row in rows
    }


def list_notes() -> list[dict[str, Any]]:
    with closing(connect()) as connection:
        rows = connection.execute(
            "SELECT * FROM notes ORDER BY updated_at DESC"
        ).fetchall()
    return [dict(row) for row in rows]


def create_note(module_slug: str, title: str, body: str) -> dict[str, Any]:
    note_id = uuid.uuid4().hex
    now = utc_now()
    with closing(connect()) as connection, connection:
        connection.execute(
            """
            INSERT INTO notes (id, module_slug, title, body, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (note_id, module_slug, title, body, now, now),
        )
    return {
        "id": note_id,
        "module_slug": module_slug,
        "title": title,
        "body": body,
        "created_at": now,
        "updated_at": now,
    }


def delete_note(note_id: str) -> bool:
    with closing(connect()) as connection, connection:
        cursor = connection.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    return cursor.rowcount > 0
