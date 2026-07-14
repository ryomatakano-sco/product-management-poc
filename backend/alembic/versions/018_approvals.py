"""Approval workflow (feedback heavy): staff-initiated manual inventory
adjustments wait for admin approval before any stock is touched.

Revision ID: 018
Revises: 017
"""

from alembic import op
import sqlalchemy as sa

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "approval_requests",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger, sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("payload_json", sa.JSON, nullable=False),
        sa.Column("summary", sa.String(300), nullable=True),
        sa.Column("requested_by", sa.String(120), nullable=True),
        sa.Column("status", sa.Enum("pending", "approved", "rejected", name="approval_status"),
                  nullable=False, server_default="pending"),
        sa.Column("decided_by", sa.String(120), nullable=True),
        sa.Column("decided_at", sa.DateTime, nullable=True),
        sa.Column("decision_note", sa.String(300), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index("ix_approvals_store_status", "approval_requests", ["store_id", "status", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_approvals_store_status", table_name="approval_requests")
    op.drop_table("approval_requests")
