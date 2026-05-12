from __future__ import annotations

from sqlalchemy import BigInteger, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Vendor(Base, TimestampMixin):
    """Suppliers and product brands.

    In dental practice, the supplier and the brand are often the same entity
    (e.g., Sunstar is both the brand and the distributor). We use a single
    table for both to avoid unnecessary joins. The `vendor_id` on a product
    and the `supplier_vendor_id` on a purchase order reference the same row.
    """

    __tablename__ = "vendors"
    __table_args__ = (
        Index("ix_vendors_store_id", "store_id"),
        Base.__table_args__,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stores.id"), nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)

    store: Mapped["Store"] = relationship(back_populates="vendors")  # noqa: F821
    products: Mapped[list["Product"]] = relationship(back_populates="vendor")  # noqa: F821
