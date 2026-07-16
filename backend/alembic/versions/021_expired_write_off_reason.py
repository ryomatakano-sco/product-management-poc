"""Add 'expired_write_off' to the adjustment_reason enum (B3).

Expired stock must be written off under its own auditable reason — clinics
were forced to misuse 'correction', which made waste untrackable.

Revision ID: 021
Revises: 020
"""

from alembic import op

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None

_NEW = ("ENUM('manual','sale','purchase_order_received','correction','damage',"
        "'other','refund','transfer','expired_write_off') NOT NULL")
_OLD = ("ENUM('manual','sale','purchase_order_received','correction','damage',"
        "'other','refund','transfer') NOT NULL")


def upgrade() -> None:
    op.execute(f"ALTER TABLE inventory_adjustments MODIFY COLUMN reason {_NEW}")


def downgrade() -> None:
    op.execute("UPDATE inventory_adjustments SET reason='damage' WHERE reason='expired_write_off'")
    op.execute(f"ALTER TABLE inventory_adjustments MODIFY COLUMN reason {_OLD}")
