"""Refund support on sales_records

Revision ID: 008
Revises: 007
Create Date: 2026-06-25

Adds the refund flow surfaced in the design's 返品 (return) column:

* ``refunded_at`` — timestamp set on the ORIGINAL sale when it has been
  refunded (marker + double-refund guard).
* ``refund_of_sale_id`` — self-FK from the REFUND row back to the original
  sale it reverses. NULL on regular sales.
* Adds a new value ``return`` to the ``adjustment_reason`` enum so the
  inventory audit row created when refunding can be distinguished from a
  normal ``sale`` reason.

A refund is stored as a normal SalesRecord row with negative quantity, so
the KPI aggregates (SUM of quantity * unit_price) automatically net out
against the original.
"""

from alembic import op
import sqlalchemy as sa


revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales_records",
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "sales_records",
        sa.Column("refund_of_sale_id", sa.BigInteger(), nullable=True),
    )
    op.create_foreign_key(
        "fk_sales_refund_of",
        "sales_records", "sales_records",
        ["refund_of_sale_id"], ["id"],
        ondelete="SET NULL",
    )
    # Extend the adjustment_reason ENUM with 'refund'. MySQL requires
    # rewriting the full enum list; SQLAlchemy's Enum type will now emit
    # the new value on insert.
    op.execute(
        "ALTER TABLE inventory_adjustments MODIFY COLUMN reason "
        "ENUM('manual','sale','purchase_order_received','correction','damage','other','refund') NOT NULL"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE inventory_adjustments MODIFY COLUMN reason "
        "ENUM('manual','sale','purchase_order_received','correction','damage','other') NOT NULL"
    )
    op.drop_constraint("fk_sales_refund_of", "sales_records", type_="foreignkey")
    op.drop_column("sales_records", "refund_of_sale_id")
    op.drop_column("sales_records", "refunded_at")
