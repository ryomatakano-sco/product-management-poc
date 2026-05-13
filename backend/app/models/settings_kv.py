"""Settings KV — one row per (store_id, namespace), JSON blob per namespace.

This intentionally avoids modelling every settings field as a column. The
shape of `data_json` is validated by the per-namespace Pydantic schemas in
`app.schemas.settings`, and the router does whole-blob replace on PUT.

For the demo we treat `_secret_openai_api_key` inside the `ai` namespace as
"persisted but never returned" — see app/routers/settings.py for the
scrub-on-read logic. Real key management is future scope.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, JSON, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SettingsKV(Base):
    __tablename__ = "settings_kv"
    __table_args__ = (
        UniqueConstraint("store_id", "namespace", name="uq_settings_store_ns"),
        Base.__table_args__,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("stores.id"), nullable=False,
    )
    namespace: Mapped[str] = mapped_column(String(32), nullable=False,
        comment="One of: general | notifications | tax_rates | ai | integrations")
    data_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(), onupdate=func.now(), nullable=False,
    )
