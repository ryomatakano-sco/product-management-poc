from __future__ import annotations

from sqlalchemy import BigInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Store(Base, TimestampMixin):
    __tablename__ = "stores"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relationships
    branches: Mapped[list["Branch"]] = relationship(back_populates="store")  # noqa: F821
    vendors: Mapped[list["Vendor"]] = relationship(back_populates="store")  # noqa: F821
    categories: Mapped[list["Category"]] = relationship(back_populates="store")  # noqa: F821
    products: Mapped[list["Product"]] = relationship(back_populates="store")  # noqa: F821
    tags: Mapped[list["Tag"]] = relationship(back_populates="store")  # noqa: F821
