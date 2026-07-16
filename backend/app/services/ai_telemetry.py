"""AI correction telemetry writes (review A5, mig 020).

Compares the AI session's top candidate per field against what the user
actually saved and stages AiCorrection rows. Best-effort by contract: any
failure here is logged and swallowed — telemetry must never block a save.
"""

from __future__ import annotations

import logging
import unicodedata
from decimal import Decimal, InvalidOperation

from sqlalchemy import select

from app.models.ai_session import AiCorrection, AiSuggestionFieldOption
from app.models.category import Category

logger = logging.getLogger(__name__)

# session option field → how to read the saved value. Fields without a
# product-side counterpart (indications, image_url, weight…) are skipped.
_COMPARABLE_FIELDS = ("title", "name_kana", "description", "price", "category", "barcode")


def _norm(v) -> str:
    if v is None:
        return ""
    return unicodedata.normalize("NFKC", str(v).strip()).casefold()


def _num_eq(a, b) -> bool:
    try:
        return Decimal(str(a)) == Decimal(str(b))
    except (InvalidOperation, ValueError, TypeError):
        return False


async def record_ai_corrections(db, *, store_id: int, product, default_variant, session) -> None:
    """Stage one AiCorrection row per comparable AI-suggested field. Does not
    commit — rides the caller's transaction (and its rollback)."""
    try:
        options = (await db.execute(
            select(AiSuggestionFieldOption)
            .where(AiSuggestionFieldOption.session_id == session.id)
            .order_by(AiSuggestionFieldOption.position)
        )).scalars().all()
        top: dict[str, str] = {}
        for o in options:
            top.setdefault(o.field_name, o.value_text)

        category_name = None
        if product.category_id:
            category_name = (await db.execute(
                select(Category.name).where(Category.id == product.category_id)
            )).scalar_one_or_none()

        finals = {
            "title": product.name,
            "name_kana": product.name_kana,
            "description": product.description,
            "price": product.default_amount_at_payment,
            "category": category_name,
            "barcode": default_variant.barcode if default_variant is not None else None,
        }

        for field in _COMPARABLE_FIELDS:
            if field not in top:
                continue
            ai_val, final = top[field], finals[field]
            if field == "price":
                accepted = final is not None and _num_eq(ai_val, final)
            else:
                accepted = _norm(ai_val) != "" and _norm(ai_val) == _norm(final)
            db.add(AiCorrection(
                store_id=store_id,
                session_id=session.id,
                product_id=product.id,
                input_jan=session.input_jan,
                input_title=session.input_title,
                field_name=field,
                ai_value=(str(ai_val)[:500] if ai_val is not None else None),
                final_value=(str(final)[:500] if final is not None else None),
                accepted=accepted,
                model_name=session.model_name,
            ))
    except Exception:
        logger.exception("AI correction telemetry failed — product save continues")
