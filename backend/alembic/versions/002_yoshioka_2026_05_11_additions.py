"""yoshioka 2026-05-11 additions: item_type, expiry, lot, unit, reorder_url

Revision ID: 002
Revises: 001
Create Date: 2026-05-12

Adds Yoshioka's requested fields to the products table.
Items existing before this migration default to item_type='product' so
historical rows continue to behave as 物販品.
"""

from alembic import op
import sqlalchemy as sa


revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # item_type: product / consumable. Default existing rows to 'product'.
    op.add_column(
        "products",
        sa.Column(
            "item_type",
            sa.Enum("product", "consumable", name="itemtype"),
            nullable=False,
            server_default="product",
        ),
    )
    # Drop the server_default once existing rows are populated — new rows
    # will get the value from the application layer (defaults to product).
    op.alter_column("products", "item_type", server_default=None)

    op.add_column("products", sa.Column("expiry_date", sa.Date(), nullable=True))
    op.add_column("products", sa.Column("lot_number", sa.String(100), nullable=True))
    op.add_column("products", sa.Column("unit", sa.String(20), nullable=True))
    op.add_column("products", sa.Column("reorder_url", sa.String(2000), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "reorder_url")
    op.drop_column("products", "unit")
    op.drop_column("products", "lot_number")
    op.drop_column("products", "expiry_date")
    op.drop_column("products", "item_type")
    # MySQL inlines ENUM types; no separate type to drop.
