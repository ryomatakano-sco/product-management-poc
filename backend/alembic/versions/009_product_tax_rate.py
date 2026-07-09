"""Per-product tax rate (standard 10% / reduced 8%)

Revision ID: 009
Revises: 008
Create Date: 2026-06-25

Adds ``products.tax_rate`` — MySQL ENUM('standard', 'reduced') with a
server default of 'standard' so all existing rows get the 10% rate.

Why per-product and not per-category
  Japanese consumption tax's 軽減税率 (8%) applies at the product level
  (e.g. children's fluoride gel qualifies as food-adjacent while adult
  whitening gel doesn't). The rate is a property of the item itself, not
  the category it happens to live in.

The receipt-issue page uses this to compute the tax breakdown block on
qualified invoices (適格請求書).
"""

from alembic import op
import sqlalchemy as sa


revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column(
            "tax_rate",
            sa.Enum("standard", "reduced", name="tax_rate"),
            nullable=False,
            server_default="standard",
        ),
    )


def downgrade() -> None:
    op.drop_column("products", "tax_rate")
