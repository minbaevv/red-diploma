from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BASE_DIR.parent


def _load_env_file() -> None:
    """Load optional KEY=VALUE pairs from the repo `.env` without extra deps."""
    path = PROJECT_DIR / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key:
            continue
        os.environ.setdefault(key, value.strip().strip('"').strip("'"))


_load_env_file()

CONTENT_PATH = BASE_DIR / "content" / "curriculum.json"
DB_PATH = Path(os.getenv("RED_DIPLOMA_DB", str(BASE_DIR / "data" / "red_diploma.db")))
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"
RUN_TIMEOUT_SECONDS = int(os.getenv("RUN_TIMEOUT_SECONDS", "5"))


@dataclass(frozen=True)
class Settings:
    content_path: Path = CONTENT_PATH
    db_path: Path = DB_PATH
    frontend_dist: Path = FRONTEND_DIST
    run_timeout_seconds: int = RUN_TIMEOUT_SECONDS


settings = Settings()
