from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
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
