from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ProductLot(Base):
    """One received lot of a variant at a branch (migration 014).

    A tracking layer over variant_branch_stock — see services/lots.py for the
    FEFO rules. qty_on_hand across a variant's lots may be LESS than the branch
    counter (unlotted stock exists); it should never exceed it in practice.
    """

    __tablename__ = "product_lots"
    __table_args__ = (
        Index("ix_product_lots_variant_branch", "store_id", "variant_id", "branch_id"),
        Base.__table_args__,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stores.id"), nullable=False)
    variant_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("product_variants.id"), nullable=False
    )
    branch_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("branches.id"), nullable=False)
    lot_number: Mapped[str] = mapped_column(String(100), nullable=False)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    qty_on_hand: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    po_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("purchase_orders.id"), nullable=True
    )
