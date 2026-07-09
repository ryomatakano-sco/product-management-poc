"""Reorder-requested tracking on products

Revision ID: 010
Revises: 009
Create Date: 2026-07-09

Adds ``products.reorder_requested_at`` — nullable DATETIME stamped when the
user clicks 再発注する on the product detail page. Powers the 商品一覧
「再発注済」 quick-filter chip (which was a visual-only TODO until now).

Lifecycle: set by the frontend via PATCH /products/{id} when the reorder
link is opened; cleared automatically when a purchase order containing one
of the product's variants is received (the reorder is considered fulfilled).
"""

from alembic import op
import sqlalchemy as sa


revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("reorder_requested_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("products", "reorder_requested_at")
