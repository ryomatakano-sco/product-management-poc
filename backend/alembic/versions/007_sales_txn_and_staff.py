"""Add transaction_id + sold_by to sales_records

Revision ID: 007
Revises: 006
Create Date: 2026-06-25

Adds two columns needed by the design mockup's 販売記録 table:

* ``transaction_id`` — human-readable per-sale ID, format ``SL-YYYYMMDD-####``.
  Rendered in green monospace in the table and searchable from the filter bar.
* ``sold_by`` — free-text staff name (no auth/user model in this PoC, so we
  store the name directly, same shape as ``patient_ref``).

Backfill uses a window function to number pre-existing rows sequentially per
(store, JST date). Unique index on transaction_id prevents future duplicates.

Notes
  • MySQL 8 window functions can't be used directly in UPDATE, so we compute
    the new values in a derived table and join.
  • Rows with no sold_at (shouldn't exist — column is NOT NULL — but defensively
    handled) get "SL-19700101-{id:04d}" so the unique index still holds.
"""

from alembic import op
import sqlalchemy as sa


revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales_records",
        sa.Column("transaction_id", sa.String(32), nullable=True),
    )
    op.add_column(
        "sales_records",
        sa.Column("sold_by", sa.String(255), nullable=True),
    )

    # Backfill transaction_id for existing rows.
    op.execute("""
        UPDATE sales_records s
        JOIN (
            SELECT id, CONCAT(
                'SL-',
                DATE_FORMAT(CONVERT_TZ(sold_at, '+00:00', '+09:00'), '%Y%m%d'),
                '-',
                LPAD(
                    ROW_NUMBER() OVER (
                        PARTITION BY store_id,
                        DATE(CONVERT_TZ(sold_at, '+00:00', '+09:00'))
                        ORDER BY id
                    ), 4, '0'
                )
            ) AS new_txn
            FROM sales_records
            WHERE transaction_id IS NULL
        ) AS n ON n.id = s.id
        SET s.transaction_id = n.new_txn;
    """)

    op.create_unique_constraint(
        "uq_sales_transaction_id", "sales_records", ["transaction_id"]
    )
    op.alter_column(
        "sales_records", "transaction_id",
        existing_type=sa.String(32), nullable=False,
    )


def downgrade() -> None:
    op.drop_constraint("uq_sales_transaction_id", "sales_records", type_="unique")
    op.drop_column("sales_records", "sold_by")
    op.drop_column("sales_records", "transaction_id")
