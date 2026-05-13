"""Settings page — namespaced JSON blobs persisted in `settings_kv`.

One row per `(store_id, namespace)`. GET returns the blob (with secrets
scrubbed); PUT replaces it wholesale after validating against the namespace's
Pydantic schema in `app.schemas.settings`.

The AI namespace gets special handling: if the PUT body contains
`openai_api_key`, we move it into `_secret_openai_api_key` inside data_json
and return only `openai_api_key_set: bool` on subsequent GETs — we never
echo the key back to the client. (Real key management would use a secret
store; this is the PoC version.)
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Path
from sqlalchemy import select
from sqlalchemy.dialects.mysql import insert as mysql_insert

from app.deps import DB, StoreId
from app.models.settings_kv import SettingsKV
from app.schemas.settings import (
    NAMESPACE_SCHEMAS,
    AiSettings,
    GeneralSettings,
    IntegrationsSettings,
    NotificationsSettings,
    SettingsEnvelope,
    TaxRatesSettings,
)


router = APIRouter(prefix="/settings", tags=["settings"])


def _default_for_namespace(namespace: str) -> dict:
    """Return a sensible default blob for a namespace.

    Used the first time a settings_kv row is requested for a namespace where
    no row exists yet — so GET never 404s, it just returns the defaults.
    """
    return NAMESPACE_SCHEMAS[namespace]().model_dump(mode="json")


def _scrub_secrets(namespace: str, data: dict) -> dict:
    """Strip secret fields from data before returning it.

    For `ai`: removes `_secret_openai_api_key`, computes `openai_api_key_set`.
    For everything else: returns data unchanged.
    """
    if namespace != "ai":
        return data
    has_key = bool(data.get("_secret_openai_api_key") or data.get("openai_api_key"))
    clean = {k: v for k, v in data.items() if not k.startswith("_secret_")}
    clean.pop("openai_api_key", None)
    clean["openai_api_key_set"] = has_key
    return clean


@router.get(
    "/{namespace}",
    response_model=SettingsEnvelope,
    summary="設定を取得（名前空間別）",
)
async def get_settings(
    db: DB,
    store_id: StoreId,
    namespace: str = Path(..., description="general | notifications | tax_rates | ai | integrations"),
):
    if namespace not in NAMESPACE_SCHEMAS:
        raise HTTPException(
            404, detail={"detail": "未知の名前空間です", "code": "RESOURCE_NOT_FOUND"},
        )

    row = (await db.execute(
        select(SettingsKV).where(
            SettingsKV.store_id == store_id,
            SettingsKV.namespace == namespace,
        )
    )).scalar_one_or_none()

    if row is None:
        data = _default_for_namespace(namespace)
        return SettingsEnvelope(namespace=namespace, data=data, updated_at=None)

    return SettingsEnvelope(
        namespace=namespace,
        data=_scrub_secrets(namespace, row.data_json),
        updated_at=row.updated_at,
    )


@router.put(
    "/{namespace}",
    response_model=SettingsEnvelope,
    summary="設定を更新（名前空間別・全置換）",
)
async def put_settings(
    body: dict,
    db: DB,
    store_id: StoreId,
    namespace: str = Path(..., description="general | notifications | tax_rates | ai | integrations"),
):
    if namespace not in NAMESPACE_SCHEMAS:
        raise HTTPException(
            404, detail={"detail": "未知の名前空間です", "code": "RESOURCE_NOT_FOUND"},
        )

    schema_cls = NAMESPACE_SCHEMAS[namespace]
    try:
        validated = schema_cls(**body).model_dump(mode="json")
    except Exception as e:
        raise HTTPException(
            422,
            detail={
                "detail": "設定値の検証に失敗しました",
                "code": "VALIDATION_ERROR",
                "error": str(e),
            },
        )

    # AI-namespace: relocate `openai_api_key` from body to a `_secret_*` field
    # so subsequent GETs don't leak it.
    if namespace == "ai" and body.get("openai_api_key"):
        validated["_secret_openai_api_key"] = body["openai_api_key"]
    validated.pop("openai_api_key", None)

    # UPSERT — SQLAlchemy MySQL dialect supports ON DUPLICATE KEY UPDATE.
    stmt = mysql_insert(SettingsKV).values(
        store_id=store_id, namespace=namespace, data_json=validated,
    )
    stmt = stmt.on_duplicate_key_update(data_json=validated)
    await db.execute(stmt)
    await db.commit()

    row = (await db.execute(
        select(SettingsKV).where(
            SettingsKV.store_id == store_id,
            SettingsKV.namespace == namespace,
        )
    )).scalar_one()

    return SettingsEnvelope(
        namespace=namespace,
        data=_scrub_secrets(namespace, row.data_json),
        updated_at=row.updated_at,
    )
