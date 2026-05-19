"""Per-variant low_stock_threshold

Revision ID: 005
Revises: 004
Create Date: 2026-05-19

Adds ``product_variants.low_stock_threshold`` so each variant can have its
own "running low" cutoff instead of the frontend's hardcoded
``available <= 10``. Defaults to 10 so existing behavior is preserved.

Why a per-variant column and not per-product
  Clinics carry both toothbrushes (low at 50+) and anesthetic syringes (low
  at 3). A global default doesn't fit. A per-variant column lets the team
  tune the threshold case-by-case from the product edit form.

Notes
  • Default 10 matches the previous hardcoded behavior so this migration is
    a no-op for existing rows visually.
  • Stays nullable=False so the ProductList query never has to coalesce.
  • No index — the column is only read on display, never filtered on.
"""

from alembic import op
import sqlalchemy as sa


revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "product_variants",
        sa.Column(
            "low_stock_threshold",
            sa.Integer(),
            nullable=False,
            server_default="10",
        ),
    )


def downgrade() -> None:
    op.drop_column("product_variants", "low_stock_threshold")
