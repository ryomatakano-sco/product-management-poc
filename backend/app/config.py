"""Application settings.

Database connection can be configured two ways:

1. **DATABASE_URL** (full SQLAlchemy URL). Wins when set. Useful when you
   need to override the dialect, driver, or query string in one place.

2. **DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME** (split vars).
   Used when DATABASE_URL is empty. Always assembled with the async aiomysql
   driver: ``mysql+aiomysql://USER:PASSWORD@HOST:PORT/NAME``.

The split-var path exists because that's the shape most ``.env`` files use
in this team. Either form is fine; pick whichever is less friction.

OpenAI key is optional — the backend's AI agent falls back to mock data
when it's empty (see ``app/services/ai_agent.py``).
"""

from __future__ import annotations

from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv
from pydantic_settings import BaseSettings


# Load .env files into os.environ at import time. We do this explicitly
# (rather than relying on Pydantic's env_file alone) because several modules —
# e.g. app/services/ai_agent.py and app/routers/dev.py — read os.environ
# directly. Pydantic's env_file only populates the Settings instance.
#
# Search order, later files OVERRIDE earlier ones (so backend/.env wins when
# both define the same key):
#   1. <repo-root>/.env   — canonical file, also used by docker-compose
#   2. backend/.env       — native-uvicorn-only overrides (e.g. DB_HOST=127.0.0.1)
_BACKEND_DIR = Path(__file__).resolve().parent.parent  # .../backend
_REPO_ROOT = _BACKEND_DIR.parent
ENV_FILES = [_REPO_ROOT / ".env", _BACKEND_DIR / ".env"]
for _f in ENV_FILES:
    if _f.is_file():
        load_dotenv(_f, override=True)


class Settings(BaseSettings):
    # Full URL. Empty = fall back to DB_* below.
    database_url: str = ""

    # Split DB config. Defaults match the dev MySQL instance most contributors
    # run locally (root / admin / maindb / 3306). Override per-environment in .env.
    db_host: str = "host.docker.internal"  # host machine when running in Docker
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = "admin"
    db_name: str = "maindb"

    openai_api_key: str = ""
    mock_ai: str = ""  # "1" forces mock mode even when OPENAI_API_KEY is set

    model_config = {"env_file": [str(p) for p in ENV_FILES], "extra": "ignore"}

    @property
    def resolved_database_url(self) -> str:
        """Return the DATABASE_URL to actually use.

        If ``database_url`` is non-empty we return it verbatim. Otherwise we
        assemble one from the DB_* split vars, URL-quoting the password so
        characters like ``@`` or ``#`` don't break parsing.
        """
        if self.database_url.strip():
            return self.database_url
        pw = quote_plus(self.db_password)
        return (
            f"mysql+aiomysql://{self.db_user}:{pw}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


settings = Settings()
