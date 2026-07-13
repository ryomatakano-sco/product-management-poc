"""Add 'transfer' to the adjustment_reason enum (branch-to-branch transfers)

Revision ID: 015
Revises: 014
Create Date: 2026-07-13

POST /inventory/transfer moves stock between two branches of the same store
via two paired adjustments (−qty at source, +qty at destination), both logged
with reason='transfer' so the audit trail reads unambiguously.
"""

from alembic import op


revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None

_NEW = "ENUM('manual','sale','purchase_order_received','correction','damage','other','refund','transfer') NOT NULL"
_OLD = "ENUM('manual','sale','purchase_order_received','correction','damage','other','refund') NOT NULL"


def upgrade() -> None:
    op.execute(f"ALTER TABLE inventory_adjustments MODIFY COLUMN reason {_NEW}")


def downgrade() -> None:
    op.execute("UPDATE inventory_adjustments SET reason='manual' WHERE reason='transfer'")
    op.execute(f"ALTER TABLE inventory_adjustments MODIFY COLUMN reason {_OLD}")
