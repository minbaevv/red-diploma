"""Test configuration.

The API tests must never touch the real progress database. Point the app at a
throw-away SQLite file before ``app.config`` is imported by the test modules.
"""

import os
import tempfile
from pathlib import Path

TEST_DB_DIR = Path(tempfile.mkdtemp(prefix="red-diploma-test-"))
os.environ["RED_DIPLOMA_DB"] = str(TEST_DB_DIR / "red_diploma.db")

# Tests must not depend on a locally running Ollama or installed Piper voices.
os.environ["JARVIS_LLM"] = "local"
os.environ["JARVIS_TTS"] = "browser"
