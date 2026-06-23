"""Add payment_method to sales_records

Revision ID: 006
Revises: 005
Create Date: 2026-06-23

Adds ``sales_records.payment_method`` so the 販売記録 page's payment-method
filter chips (現金 / カード / PayPay / 銀行振込) can actually narrow the list,
and so the planned 手動入力 modal can persist how the sale was paid for.

Why a column and not a separate payments table
  Every sale has exactly one payment method in this PoC (no split payments,
  no partial refunds yet). A single column on sales_records keeps the read
  path one query and matches the brief.

Notes
  • server_default='cash' so pre-existing rows get a sensible value and the
    column can stay NOT NULL.
  • Composite index on (store_id, payment_method, sold_at) so the filtered
    list query stays index-only.
"""

from alembic import op
import sqlalchemy as sa


revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales_records",
        sa.Column(
            "payment_method",
            sa.Enum("cash", "card", "paypay", "bank_transfer", name="payment_method"),
            nullable=False,
            server_default="cash",
        ),
    )
    op.create_index(
        "ix_sales_store_payment_date",
        "sales_records",
        ["store_id", "payment_method", "sold_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_sales_store_payment_date", table_name="sales_records")
    op.drop_column("sales_records", "payment_method")
