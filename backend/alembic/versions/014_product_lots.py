"""Per-lot expiry & quantity tracking with FEFO (heavy-tier item 4)

Revision ID: 014
Revises: 013
Create Date: 2026-07-10

Adds ``product_lots`` — one row per received lot of a variant at a branch.
Lots are a TRACKING LAYER on top of the per-branch counters
(variant_branch_stock stays the stock source of truth):

  • PO receive can capture ロット番号/使用期限 per line → creates/merges a lot.
  • Sales decrement lots FEFO (earliest expiry first, NULL-expiry last) at the
    sale's branch; refunds add back to the newest open lot.
  • Manual adjustments deliberately do NOT touch lots (PoC gap, documented) —
    the lots tab therefore shows 追跡分 which may be less than total stock.

Backfill: consumable products that already carry lot_number/expiry_date get an
initial lot per stocked branch row with qty = that branch's on_hand.
"""

from alembic import op
import sqlalchemy as sa


revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "product_lots",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger(),
                  sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("variant_id", sa.BigInteger(),
                  sa.ForeignKey("product_variants.id"), nullable=False),
        sa.Column("branch_id", sa.BigInteger(),
                  sa.ForeignKey("branches.id"), nullable=False),
        sa.Column("lot_number", sa.String(100), nullable=False),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("qty_on_hand", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("received_at", sa.DateTime(timezone=True),
                  server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("po_id", sa.BigInteger(),
                  sa.ForeignKey("purchase_orders.id"), nullable=True),
    )
    op.create_index("ix_product_lots_variant_branch", "product_lots",
                    ["store_id", "variant_id", "branch_id"])

    # Backfill: existing consumables with lot/expiry info → one lot per stocked
    # branch row, qty = that branch's current on_hand.
    op.execute("""
        INSERT INTO product_lots
            (store_id, variant_id, branch_id, lot_number, expiry_date, qty_on_hand)
        SELECT vbs.store_id, vbs.variant_id, vbs.branch_id,
               COALESCE(p.lot_number, CONCAT('LOT-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', v.id)),
               p.expiry_date, vbs.on_hand
          FROM variant_branch_stock vbs
          JOIN product_variants v ON v.id = vbs.variant_id
          JOIN products p ON p.id = v.product_id
         WHERE vbs.on_hand > 0
           AND p.item_type = 'consumable'
           AND (p.lot_number IS NOT NULL OR p.expiry_date IS NOT NULL)
    """)


def downgrade() -> None:
    op.drop_table("product_lots")
