from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    card = "card"
    paypay = "paypay"
    bank_transfer = "bank_transfer"


class SalesRecord(Base):
    """Append-only per-line sales events.

    A POST to /sales writes here AND creates an inventory_adjustments row
    decrementing on_hand.
    """

    __tablename__ = "sales_records"
    __table_args__ = (
        Index("ix_sales_store_variant_date", "store_id", "variant_id", "sold_at"),
        Index("ix_sales_store_payment_date", "store_id", "payment_method", "sold_at"),
        Base.__table_args__,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stores.id"), nullable=False)
    branch_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("branches.id"), nullable=False)
    variant_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("product_variants.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    payment_method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod), nullable=False, server_default="cash"
    )
    sold_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    patient_ref: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Placeholder for future patient linking"
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    branch: Mapped["Branch"] = relationship()  # noqa: F821
    variant: Mapped["ProductVariant"] = relationship(back_populates="sales_records")  # noqa: F821
