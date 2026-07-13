"""PO comment thread (feedback batch C) — lets staff without edit rights
leave warnings/suggestions on a purchase order.

Revision ID: 017
Revises: 016
"""

from alembic import op
import sqlalchemy as sa

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "po_comments",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger, sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("purchase_order_id", sa.BigInteger,
                  sa.ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author", sa.String(120), nullable=True),
        sa.Column("body", sa.String(1000), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index("ix_po_comments_po", "po_comments", ["purchase_order_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_po_comments_po", table_name="po_comments")
    op.drop_table("po_comments")
