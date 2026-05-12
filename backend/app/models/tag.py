from __future__ import annotations

from sqlalchemy import BigInteger, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Tag(Base, TimestampMixin):
    __tablename__ = "tags"
    __table_args__ = (
        UniqueConstraint("store_id", "name", name="uq_tags_store_name"),
        Index("ix_tags_store_id", "store_id"),
        Base.__table_args__,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("stores.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    store: Mapped["Store"] = relationship(back_populates="tags")  # noqa: F821
    products: Mapped[list["Product"]] = relationship(  # noqa: F821
        secondary="product_tags", back_populates="tags"
    )


class ProductTag(Base):
    __tablename__ = "product_tags"

    product_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("products.id"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tags.id"), primary_key=True
    )
