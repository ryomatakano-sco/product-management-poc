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

from urllib.parse import quote_plus

from pydantic_settings import BaseSettings


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

    model_config = {"env_file": ".env", "extra": "ignore"}

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
