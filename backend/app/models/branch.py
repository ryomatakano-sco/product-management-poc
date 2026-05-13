from __future__ import annotations

import enum

from sqlalchemy import BigInteger, Boolean, Enum, ForeignKey, Index, Integer, JSON, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class BranchType(str, enum.Enum):
    main = "main"   # 本院
    sub = "sub"     # 分院


class BranchStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"


class Branch(Base, TimestampMixin):
    __tablename__ = "branches"
    __table_args__ = (
        Index("ix_branches_store_id", "store_id"),
        Base.__table_args__,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stores.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Migration 003 — operational fields the branches page needs (brief §2.1).
    branch_type: Mapped[BranchType] = mapped_column(
        Enum(BranchType, name="branch_type_enum"),
        default=BranchType.main, nullable=False,
    )
    postal_code: Mapped[str | None] = mapped_column(String(8), nullable=True)
    manager_name: Mapped[str | None] = mapped_column(String(128), nullable=True,
        comment="院長/管理者 — displayed in the 院・店舗 card.")
    operating_hours_json: Mapped[dict | None] = mapped_column(JSON, nullable=True,
        comment="Per-day hour ranges; see brief §2.2 for shape.")
    default_tax_rate: Mapped[float] = mapped_column(
        Numeric(4, 2), default=10.00, nullable=False,
    )
    low_stock_threshold: Mapped[int] = mapped_column(
        Integer, default=10, nullable=False,
        comment="Per-branch override of the 在庫低下 alert threshold.",
    )
    status: Mapped[BranchStatus] = mapped_column(
        Enum(BranchStatus, name="branch_status_enum"),
        default=BranchStatus.active, nullable=False,
    )

    store: Mapped["Store"] = relationship(back_populates="branches")  # noqa: F821
