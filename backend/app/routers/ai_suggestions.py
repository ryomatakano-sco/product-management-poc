"""AI suggestion endpoints: create session, get session, apply option."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import DB, StoreId
from app.models.ai_session import AiSessionStatus, AiSuggestionFieldOption, AiSuggestionSession
from app.schemas.ai_suggestion import (
    AiFieldOptionRead,
    AiOptionApply,
    AiSuggestionRead,
    AiSuggestionRequest,
)
from app.services.ai_agent import DEFAULT_MODEL, run_product_lookup

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai-suggestions", tags=["ai-suggestions"])


def _session_to_read(session: AiSuggestionSession) -> AiSuggestionRead:
    """Convert a session ORM object to the API response shape."""
    options: dict[str, list[AiFieldOptionRead]] = defaultdict(list)
    for opt in sorted(session.field_options, key=lambda o: (o.field_name, o.position)):
        options[opt.field_name].append(
            AiFieldOptionRead(
                id=opt.id,
                value=opt.value_text,
                source_url=opt.source_url,
                source_title=opt.source_title,
                confidence=opt.confidence,
                position=opt.position,
                was_applied=opt.was_applied,
            )
        )
    return AiSuggestionRead(
        id=session.id,
        store_id=session.store_id,
        input_jan=session.input_jan,
        input_title=session.input_title,
        status=session.status,
        model_name=session.model_name,
        options=dict(options),
        raw_agent_log=session.raw_agent_log,
        error_message=session.error_message,
        created_at=session.created_at,
        completed_at=session.completed_at,
        applied_to_product_id=session.applied_to_product_id,
    )


@router.post("", response_model=AiSuggestionRead, status_code=201)
async def create_ai_suggestion(body: AiSuggestionRequest, db: DB, store_id: StoreId):
    if not body.jan and not body.title:
        raise HTTPException(400, detail="At least one of 'jan' or 'title' is required")

    session = AiSuggestionSession(
        store_id=store_id,
        input_jan=body.jan,
        input_title=body.title,
        status=AiSessionStatus.pending,
        model_name=DEFAULT_MODEL,
    )
    db.add(session)
    await db.flush()

    try:
        result = await run_product_lookup(jan=body.jan, title=body.title)

        # Persist candidates as field_options
        for i, candidate in enumerate(result.candidates):
            # Anti-hallucination: reject options without source_url (except name_kana)
            if candidate.field_name != "name_kana" and not candidate.source_url:
                continue
            opt = AiSuggestionFieldOption(
                session_id=session.id,
                field_name=candidate.field_name,
                value_text=candidate.value,
                source_url=candidate.source_url,
                source_title=candidate.source_title,
                confidence=candidate.confidence,
                position=i,
            )
            db.add(opt)

        session.status = AiSessionStatus.completed
        session.completed_at = datetime.now(timezone.utc)
        session.raw_agent_log = result.raw_search_notes

    except Exception as e:
        logger.error("AI suggestion failed: %s", e, exc_info=True)
        session.status = AiSessionStatus.failed
        session.error_message = str(e)
        session.completed_at = datetime.now(timezone.utc)

    await db.commit()

    # Reload with options
    loaded = (
        await db.execute(
            select(AiSuggestionSession)
            .where(AiSuggestionSession.id == session.id)
            .options(selectinload(AiSuggestionSession.field_options))
        )
    ).scalar_one()
    return _session_to_read(loaded)


@router.get("/{session_id}", response_model=AiSuggestionRead)
async def get_ai_suggestion(session_id: int, db: DB, store_id: StoreId):
    session = (
        await db.execute(
            select(AiSuggestionSession)
            .where(AiSuggestionSession.id == session_id, AiSuggestionSession.store_id == store_id)
            .options(selectinload(AiSuggestionSession.field_options))
        )
    ).scalar_one_or_none()
    if not session:
        raise HTTPException(404, detail="AI suggestion session not found")
    return _session_to_read(session)


@router.patch("/{session_id}/options/{option_id}", response_model=AiFieldOptionRead)
async def apply_option(session_id: int, option_id: int, body: AiOptionApply, db: DB, store_id: StoreId):
    """Mark an AI suggestion option as applied (or un-applied)."""
    session = (
        await db.execute(
            select(AiSuggestionSession).where(
                AiSuggestionSession.id == session_id, AiSuggestionSession.store_id == store_id
            )
        )
    ).scalar_one_or_none()
    if not session:
        raise HTTPException(404, detail="AI suggestion session not found")

    option = (
        await db.execute(
            select(AiSuggestionFieldOption).where(
                AiSuggestionFieldOption.id == option_id,
                AiSuggestionFieldOption.session_id == session_id,
            )
        )
    ).scalar_one_or_none()
    if not option:
        raise HTTPException(404, detail="Option not found")

    option.was_applied = body.was_applied
    await db.commit()
    await db.refresh(option)
    return AiFieldOptionRead(
        id=option.id,
        value=option.value_text,
        source_url=option.source_url,
        source_title=option.source_title,
        confidence=option.confidence,
        position=option.position,
        was_applied=option.was_applied,
    )
