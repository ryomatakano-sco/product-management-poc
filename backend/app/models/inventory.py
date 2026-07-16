from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    BigInteger, DateTime, Enum, ForeignKey, Index, Integer, String, Text,
    UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class InventoryField(str, enum.Enum):
    on_hand = "on_hand"
    committed = "committed"
    unavailable = "unavailable"


class AdjustmentReason(str, enum.Enum):
    manual = "manual"
    sale = "sale"
    purchase_order_received = "purchase_order_received"
    correction = "correction"
    damage = "damage"
    other = "other"
    refund = "refund"
    transfer = "transfer"  # branch-to-branch move (migration 015)
    expired_write_off = "expired_write_off"  # expired-lot disposal (migration 021, B3)


class InventoryAdjustment(Base):
    __tablename__ = "inventory_adjustments"
    __table_args__ = (
        Index("ix_inv_adj_store_variant", "store_id", "variant_id"),
        Base.__table_args__,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stores.id"), nullable=False)
    variant_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("product_variants.id"), nullable=False
    )
    branch_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("branches.id"), nullable=True,
        comment="Branch the stock moved at (NULL for pre-012 rows)",
    )
    field: Mapped[InventoryField] = mapped_column(Enum(InventoryField), nullable=False)
    delta: Mapped[int] = mapped_column(Integer, nullable=False, comment="Signed: +N or -N")
    reason: Mapped[AdjustmentReason] = mapped_column(Enum(AdjustmentReason), nullable=False)
    reference_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="e.g. 'purchase_order', 'sales_record'"
    )
    reference_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    variant: Mapped["ProductVariant"] = relationship(  # noqa: F821
        back_populates="inventory_adjustments"
    )


class VariantBranchStock(Base):
    """Per-(variant, branch) stock counters — added by migration 012.

    ``product_variants.on_hand/committed/unavailable`` stay as the store-wide
    denormalized TOTALS; services/stock.py keeps both in sync in one txn.
    """

    __tablename__ = "variant_branch_stock"
    __table_args__ = (
        UniqueConstraint("variant_id", "branch_id", name="uq_vbs_variant_branch"),
        Index("ix_vbs_store_branch", "store_id", "branch_id"),
        Base.__table_args__,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stores.id"), nullable=False)
    variant_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("product_variants.id"), nullable=False
    )
    branch_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("branches.id"), nullable=False)
    on_hand: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    committed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unavailable: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
