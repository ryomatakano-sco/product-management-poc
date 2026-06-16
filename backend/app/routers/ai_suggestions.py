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
from app.models.category import Category
from app.models.vendor import Vendor, VendorStatus
from app.schemas.ai_suggestion import (
    AiDebugCandidate,
    AiDebugDropped,
    AiFieldOptionRead,
    AiOptionApply,
    AiSuggestionCompare,
    AiSuggestionCompareRequest,
    AiCompareStepCost,
    AiSuggestionCompareResult,
    AiSuggestionDebug,
    AiSuggestionRead,
    AiSuggestionRequest,
)
from app.services.ai_agent import DEFAULT_MODEL, model_can_search, run_product_lookup
from app.services.jan import normalize_jan, validate_check_digit


def _normalised_jan_or_422(raw: str | None) -> str | None:
    """Validate + normalise an incoming JAN string.

    Returns the cleaned digit form on success. Returns ``None`` if no JAN was
    supplied. Raises HTTPException(422) on malformed input so the caller
    doesn't have to repeat the boilerplate.

    Order matters: shape check first (so we can say "wrong length"), then
    check digit (so we can say "valid shape, bad check digit"). The user-
    facing message stays generic because the AI Assist modal isn't a JAN
    validator — we just want bad input to fail fast and cheap.
    """
    if not raw:
        return None
    normalised = normalize_jan(raw)
    if normalised is None:
        raise HTTPException(422, detail="JAN コードの形式が正しくありません (8桁または13桁の数字をご入力ください)")
    if not validate_check_digit(normalised):
        raise HTTPException(422, detail="JAN コードのチェックディジットが正しくありません")
    return normalised

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai-suggestions", tags=["ai-suggestions"])

# Tier 3a: fields where a source URL is mandatory (verifiable claims).
# All other fields are "lenient" — value kept even if no inline citation,
# because the search agent's narrative is itself the source.
STRICT_CITATION_FIELDS: frozenset[str] = frozenset(
    {"price", "weight", "image_url", "fluoride_ppm", "dimensions"}
)


def jan_verified_for(jan: str | None, source_url: str | None) -> bool:
    """Wave-1 (no-fetch) JAN-presence check: True when the queried JAN appears
    verbatim in the candidate's source URL.

    Retailers (Matsukiyo / Welcia / Rakuten / Hands …) bake the JAN literal into
    the URL path, so finding it there is near-conclusive evidence the page is
    about *that exact* product. Manufacturer slug URLs won't match — handled by
    the "drop only when something else verified" rule in `wrong_product_drop`.
    """
    return bool(jan and source_url and jan in source_url)


def wrong_product_drop(jan: str | None, candidates) -> bool:
    """Decide whether the wrong-product guard should fire for this result set.

    The accuracy bug: a JAN search for an Ora2 product returns a validly-cited
    GUM product. The fix is to drop candidates whose URL doesn't contain the
    queried JAN — BUT only when we have positive evidence of the right product
    elsewhere in the set. Otherwise we'd discard every manufacturer-official
    candidate (Tier-1 slug URLs never contain the JAN), gutting recall.

    Rule: the guard fires only on a JAN search where *at least one* candidate
    is jan_verified. In that case the unverified candidates are the likely
    wrong-product noise and get dropped. If zero candidates verify (e.g. only
    manufacturer slugs were cited) we can't distinguish right from wrong cheaply,
    so we keep everything and leave it to the human + the Wave-2 fetch verifier.

    Title/name-only searches pass ``jan=None`` → returns False → nothing dropped.
    """
    if not jan:
        return False
    return any(jan_verified_for(jan, getattr(c, "source_url", None)) for c in candidates)


async def _load_master_lists(db, store_id: int) -> tuple[list[str], list[str]]:
    """Fetch the store's category names + active vendor names for prompt injection.

    Item-3 (server-side mapping fix): these are passed to ``run_product_lookup``
    so the search agent emits canonical master-list spellings. Vendor list is
    limited to status=active (don't steer the model toward archived suppliers).
    Capped at 200 each to keep the prompt bounded.
    """
    cat_rows = (
        await db.execute(
            select(Category.name)
            .where(Category.store_id == store_id)
            .order_by(Category.sort_order, Category.name)
            .limit(200)
        )
    ).scalars().all()
    vend_rows = (
        await db.execute(
            select(Vendor.company_name)
            .where(Vendor.store_id == store_id, Vendor.status == VendorStatus.active)
            .order_by(Vendor.company_name)
            .limit(200)
        )
    ).scalars().all()
    categories = [c for c in cat_rows if c and c.strip()]
    vendors = [v for v in vend_rows if v and v.strip()]
    return categories, vendors


def _session_to_read(
    session: AiSuggestionSession,
    *,
    from_cache: bool = False,
    new_pairs: set | None = None,
) -> AiSuggestionRead:
    """Convert a session ORM object to the API response shape.

    ``from_cache`` / ``new_pairs`` are transient (not stored in the DB) and only
    passed by the create endpoint: ``from_cache`` flags a cache-served result,
    and ``new_pairs`` is the set of (field_name, value) newly found in a refresh
    — used to mark each option ``is_new``.
    """
    new_pairs = new_pairs or set()
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
                is_new=(opt.field_name, (opt.value_text or "").strip()) in new_pairs,
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
        from_cache=from_cache,
    )


@router.post("", response_model=AiSuggestionRead, status_code=201)
async def create_ai_suggestion(body: AiSuggestionRequest, db: DB, store_id: StoreId):
    if not body.jan and not body.title:
        raise HTTPException(400, detail="At least one of 'jan' or 'title' is required")

    # Validate + normalise the JAN before any model call. NFKC strips full-
    # width digits to ASCII, the mod-10 check digit rejects typos. Saves an
    # OpenAI round-trip on malformed input (422 instead of a confused model).
    jan = _normalised_jan_or_422(body.jan)
    title = body.title

    session = AiSuggestionSession(
        store_id=store_id,
        input_jan=jan,
        input_title=title,
        status=AiSessionStatus.pending,
        model_name=DEFAULT_MODEL,
    )
    db.add(session)
    await db.flush()

    # Item-3: inject the store's master lists so the agent emits canonical
    # category/vendor spellings (server-side half of the mapping fix).
    categories, vendors = await _load_master_lists(db, store_id)

    from_cache = False
    new_pairs: set = set()
    try:
        outcome = await run_product_lookup(
            jan=jan, title=title, allow_fallback=body.allow_fallback,
            categories=categories, vendors=vendors, refresh=body.refresh,
        )
        result = outcome.result
        from_cache = outcome.from_cache
        # (field_name, value) of candidates newly found by a refresh — so the
        # response can flag the corresponding persisted options is_new.
        new_pairs = {
            (c.field_name, (c.value or "").strip())
            for c in result.candidates if getattr(c, "is_new", False)
        }

        # Wrong-product guard: on a JAN search where at least one candidate's
        # URL contains the queried JAN, the unverified candidates are likely a
        # different product (the Ora2-search-returns-GUM bug) — drop them.
        drop_unverified = wrong_product_drop(jan, result.candidates)

        # Persist candidates as field_options
        for i, candidate in enumerate(result.candidates):
            # Anti-hallucination: only strict-citation fields require a source_url.
            # Lenient fields (title, brand, description, category, indications, etc.)
            # are kept even without an inline citation — the search agent's
            # narrative as a whole is the source.
            if candidate.field_name in STRICT_CITATION_FIELDS and not candidate.source_url:
                continue
            if drop_unverified and not jan_verified_for(jan, candidate.source_url):
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
    return _session_to_read(loaded, from_cache=from_cache, new_pairs=new_pairs)


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


@router.post("/debug", response_model=AiSuggestionDebug)
async def debug_ai_suggestion(body: AiSuggestionRequest):
    """Read-only inspection of the AI pipeline.

    Runs the same two-agent lookup as POST /ai-suggestions but does NOT
    persist anything to the database. Returns the raw search-agent text,
    every candidate the extraction agent produced, and which of those were
    dropped by the strict-citation filter (with reasons).

    Use this to investigate why a given JAN under-fetches in production.
    """
    if not body.jan and not body.title:
        raise HTTPException(400, detail="At least one of 'jan' or 'title' is required")

    # Same JAN gate as the create endpoint so /debug fails fast on garbage.
    jan = _normalised_jan_or_422(body.jan)
    title = body.title

    try:
        outcome = await run_product_lookup(
            jan=jan, title=title, allow_fallback=body.allow_fallback,
        )
        result = outcome.result
    except Exception as e:
        logger.error("AI debug failed: %s", e, exc_info=True)
        return AiSuggestionDebug(
            model_used=DEFAULT_MODEL,
            found=False,
            raw_search_notes=None,
            candidates=[],
            dropped_candidates=[],
            strict_citation_fields=sorted(STRICT_CITATION_FIELDS),
            error_message=str(e),
        )

    kept: list[AiDebugCandidate] = []
    dropped: list[AiDebugDropped] = []
    # Same wrong-product guard as the create path, surfaced here as drop reasons
    # so /debug shows exactly what production would persist.
    drop_unverified = wrong_product_drop(jan, result.candidates)
    for c in result.candidates:
        if c.field_name in STRICT_CITATION_FIELDS and not c.source_url:
            dropped.append(
                AiDebugDropped(
                    field_name=c.field_name,
                    value=c.value,
                    reason="missing source_url for strict-citation field",
                )
            )
            continue
        # Free JAN-presence check: substring-match the queried JAN against
        # the source URL. Retailers like Matsukiyo / Welcia / Rakuten / Hands
        # bake the JAN literal into the URL path; finding it there is
        # near-conclusive evidence the page is about that exact product.
        # Manufacturer slug URLs (jp.sunstar.com/oralcare/gum/product_054.html)
        # won't match — that's expected. See Wave 2 for fetch-based verifier.
        verified = jan_verified_for(jan, c.source_url)
        if drop_unverified and not verified:
            dropped.append(
                AiDebugDropped(
                    field_name=c.field_name,
                    value=c.value,
                    reason="JAN not present in source_url (wrong-product guard)",
                )
            )
            continue
        kept.append(
            AiDebugCandidate(
                field_name=c.field_name,
                value=c.value,
                source_url=c.source_url,
                source_title=c.source_title,
                confidence=c.confidence,
                jan_verified=verified,
            )
        )

    return AiSuggestionDebug(
        model_used=DEFAULT_MODEL,
        found=getattr(result, "found", bool(kept)),
        raw_search_notes=result.raw_search_notes,
        candidates=kept,
        dropped_candidates=dropped,
        strict_citation_fields=sorted(STRICT_CITATION_FIELDS),
    )


# ---------------------------------------------------------------------------
# POST /ai-suggestions/compare — dev-only model arena.
# ---------------------------------------------------------------------------


def _step_costs_from_outcome(outcome) -> list[AiCompareStepCost]:
    return [
        AiCompareStepCost(
            step=s.step,
            model=s.model,
            input_tokens=s.input_tokens,
            output_tokens=s.output_tokens,
            cached_input_tokens=s.cached_input_tokens,
            requests=s.requests,
            cost_usd=s.cost_usd,
            pricing_known=s.pricing_known,
        )
        for s in outcome.cost_breakdown
    ]


def _build_compare_result_from_lookup(
    model_id: str,
    outcome,
    jan: str | None,
    wall_time_ms: int,
) -> AiSuggestionCompareResult:
    """Apply the same citation + JAN-substring rules as /debug, per model.

    Kept private to this module — only the /compare endpoint needs it.
    """
    raw_result = outcome.result
    kept: list[AiDebugCandidate] = []
    dropped: list[AiDebugDropped] = []
    drop_unverified = wrong_product_drop(jan, raw_result.candidates)
    for c in raw_result.candidates:
        if c.field_name in STRICT_CITATION_FIELDS and not c.source_url:
            dropped.append(AiDebugDropped(
                field_name=c.field_name,
                value=c.value,
                reason="missing source_url for strict-citation field",
            ))
            continue
        verified = jan_verified_for(jan, c.source_url)
        if drop_unverified and not verified:
            dropped.append(AiDebugDropped(
                field_name=c.field_name,
                value=c.value,
                reason="JAN not present in source_url (wrong-product guard)",
            ))
            continue
        kept.append(AiDebugCandidate(
            field_name=c.field_name,
            value=c.value,
            source_url=c.source_url,
            source_title=c.source_title,
            confidence=c.confidence,
            jan_verified=verified,
        ))
    return AiSuggestionCompareResult(
        model=model_id,
        found=getattr(raw_result, "found", bool(kept)),
        wall_time_ms=wall_time_ms,
        raw_search_notes=raw_result.raw_search_notes,
        candidates=kept,
        dropped_candidates=dropped,
        is_mock=outcome.is_mock,
        total_cost_usd=outcome.total_cost_usd,
        total_cost_jpy=outcome.total_cost_jpy,
        cost_breakdown=_step_costs_from_outcome(outcome),
    )


@router.post("/compare", response_model=AiSuggestionCompare)
async def compare_ai_suggestion(body: AiSuggestionCompareRequest):
    """Run the same lookup against N models in parallel.

    Used by the DevPanel model arena to A/B which model produces the best
    recall/quality. Not user-facing. Caller-supplied model ids are passed
    through to run_product_lookup verbatim so we don't have to ship a
    backend change every time OpenAI releases a new model variant.

    asyncio.gather(return_exceptions=True) means one model failing doesn't
    kill the whole run — each result row carries its own error_message.
    """
    import asyncio
    import time

    if not body.jan and not body.title:
        raise HTTPException(400, detail="At least one of 'jan' or 'title' is required")
    if not body.models:
        raise HTTPException(400, detail="At least one model id is required")
    if len(body.models) > 6:
        raise HTTPException(400, detail="Up to 6 models per call")

    jan = _normalised_jan_or_422(body.jan)
    title = body.title

    async def _one(model_id: str) -> AiSuggestionCompareResult:
        start = time.perf_counter()
        # Fast-fail: refuse to spend a request on a model that we know can't
        # do web search. Catches gpt-4.1-nano and gpt-5-nano up-front before
        # we hit OpenAI's 400.
        if not model_can_search(model_id):
            return AiSuggestionCompareResult(
                model=model_id,
                found=False,
                wall_time_ms=int((time.perf_counter() - start) * 1000),
                error_message=(
                    f"{model_id} は web 検索に対応していません。"
                    " 検索エージェントには gpt-4.1 / gpt-4.1-mini / gpt-5 / gpt-5-mini を選択してください。"
                ),
            )
        try:
            outcome = await run_product_lookup(
                jan=jan, title=title, model=model_id, allow_fallback=False,
            )
            elapsed = int((time.perf_counter() - start) * 1000)
            return _build_compare_result_from_lookup(model_id, outcome, jan, elapsed)
        except Exception as e:  # noqa: BLE001 — surface error per model
            elapsed = int((time.perf_counter() - start) * 1000)
            logger.error("Compare run failed for model=%s: %s", model_id, e, exc_info=True)
            return AiSuggestionCompareResult(
                model=model_id,
                found=False,
                wall_time_ms=elapsed,
                error_message=str(e),
            )

    results = await asyncio.gather(*[_one(m) for m in body.models])
    return AiSuggestionCompare(
        jan=jan,
        title=title,
        strict_citation_fields=sorted(STRICT_CITATION_FIELDS),
        results=list(results),
    )
