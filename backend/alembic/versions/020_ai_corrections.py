"""AI correction telemetry (review A5).

One row per (product-save, AI-suggested field): what the AI proposed vs what
the user actually saved. Every day of normal use grows the eval set that the
recall/accuracy work (ADR 0001, title guard A4) needs — real field-accuracy
numbers instead of sampling.

Revision ID: 020
Revises: 019
"""

from alembic import op
import sqlalchemy as sa

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_corrections",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger, sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("session_id", sa.BigInteger, sa.ForeignKey("ai_suggestion_sessions.id"), nullable=True),
        sa.Column("product_id", sa.BigInteger, nullable=True),
        sa.Column("input_jan", sa.String(50), nullable=True),
        sa.Column("input_title", sa.String(500), nullable=True),
        sa.Column("field_name", sa.String(50), nullable=False),
        sa.Column("ai_value", sa.String(500), nullable=True),
        sa.Column("final_value", sa.String(500), nullable=True),
        sa.Column("accepted", sa.Boolean, nullable=False),
        sa.Column("model_name", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index("ix_ai_corrections_store_created", "ai_corrections", ["store_id", "created_at"])
    op.create_index("ix_ai_corrections_store_field", "ai_corrections", ["store_id", "field_name"])


def downgrade() -> None:
    op.drop_index("ix_ai_corrections_store_field", table_name="ai_corrections")
    op.drop_index("ix_ai_corrections_store_created", table_name="ai_corrections")
    op.drop_table("ai_corrections")
