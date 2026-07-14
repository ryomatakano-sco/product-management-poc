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
    transaction_id: Mapped[str] = mapped_column(
        String(32), nullable=False, unique=True,
        comment="Human-readable ID, format SL-YYYYMMDD-####",
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    payment_method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod), nullable=False, server_default="cash"
    )
    sold_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sold_by: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Free-text staff name (no user model yet)",
    )
    patient_ref: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Free-text patient name/reference",
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Display-name snapshot of the logged-in user who performed the write
    # (mig 016). sold_by stays the user-entered staff field.
    created_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    refunded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="Set on the original sale when it has been refunded",
    )
    refund_of_sale_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("sales_records.id", ondelete="SET NULL"), nullable=True,
        comment="On a refund row, points to the original sale being reversed",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    branch: Mapped["Branch"] = relationship()  # noqa: F821
    variant: Mapped["ProductVariant"] = relationship(back_populates="sales_records")  # noqa: F821
