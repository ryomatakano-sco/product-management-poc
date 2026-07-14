"""Per-branch inventory (heavy-tier item 2)

Revision ID: 012
Revises: 011
Create Date: 2026-07-10

Adds ``variant_branch_stock`` — one row per (variant, branch) holding that
branch's counters — and ``inventory_adjustments.branch_id`` so the audit trail
records WHERE stock moved.

Design (see CONTEXT.md §8.2):
  • ``product_variants.on_hand/committed/unavailable`` REMAIN the store-wide
    denormalized totals. Every existing read keeps working. Write paths go
    through services/stock.py which updates the branch row AND the total in
    the same transaction.
  • Backfill: each variant's current counters are assigned to the store's
    main branch (lowest-id branch with branch_type='main'; falls back to the
    store's lowest-id branch if no main exists).
"""

from alembic import op
import sqlalchemy as sa


revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "variant_branch_stock",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger(),
                  sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("variant_id", sa.BigInteger(),
                  sa.ForeignKey("product_variants.id"), nullable=False),
        sa.Column("branch_id", sa.BigInteger(),
                  sa.ForeignKey("branches.id"), nullable=False),
        sa.Column("on_hand", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("committed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unavailable", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
                  nullable=False),
        sa.UniqueConstraint("variant_id", "branch_id", name="uq_vbs_variant_branch"),
    )
    op.create_index("ix_vbs_store_branch", "variant_branch_stock", ["store_id", "branch_id"])

    op.add_column(
        "inventory_adjustments",
        sa.Column("branch_id", sa.BigInteger(),
                  sa.ForeignKey("branches.id"), nullable=True,
                  comment="Branch the stock moved at (NULL for pre-012 rows)"),
    )

    # Backfill: current variant totals → the store's main branch.
    op.execute("""
        INSERT INTO variant_branch_stock
            (store_id, variant_id, branch_id, on_hand, committed, unavailable)
        SELECT v.store_id, v.id,
               COALESCE(
                   (SELECT b.id FROM branches b
                     WHERE b.store_id = v.store_id AND b.branch_type = 'main'
                     ORDER BY b.id LIMIT 1),
                   (SELECT b2.id FROM branches b2
                     WHERE b2.store_id = v.store_id ORDER BY b2.id LIMIT 1)
               ),
               v.on_hand, v.committed, v.unavailable
          FROM product_variants v
         WHERE EXISTS (SELECT 1 FROM branches b3 WHERE b3.store_id = v.store_id)
    """)


def downgrade() -> None:
    op.drop_column("inventory_adjustments", "branch_id")
    op.drop_table("variant_branch_stock")
