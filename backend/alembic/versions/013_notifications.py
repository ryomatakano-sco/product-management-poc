"""In-app notifications (heavy-tier item 3)

Revision ID: 013
Revises: 012
Create Date: 2026-07-10

Adds ``notifications`` — the store's event feed. Powers the AdminShell bell
(dropdown + unread dot) and is the source for optional email delivery
(services/notifier.py, honoring the 設定 › 通知 toggles that have persisted
since prompt 03 but never dispatched anything).

Kinds used by the emitters: low_stock, expiring_soon, po_status, daily_summary.
"""

from alembic import op
import sqlalchemy as sa


revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger(),
                  sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("link_path", sa.String(255), nullable=True,
                  comment="Frontend hash path, e.g. /products/3"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_notifications_store_unread", "notifications",
                    ["store_id", "read_at"])


def downgrade() -> None:
    op.drop_table("notifications")
