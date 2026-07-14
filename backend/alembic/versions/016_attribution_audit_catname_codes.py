"""User attribution on writes, audit_events table, category EN names,
internal product codes (feedback batch B).

- created_by (display name snapshot) on sales_records / inventory_adjustments /
  purchase_orders — who performed the write, from the session cookie.
- audit_events: append-only log (user add/delete/role change, settings edits, …).
- categories.name_en: optional English label, shown in EN mode with JA fallback.
- products.internal_code: per-store human code, CA#### for consumables /
  PR#### for retail, backfilled by id order.

Revision ID: 016_attribution_audit_catname_codes
Revises: 015_transfer_reason
"""

from alembic import op
import sqlalchemy as sa

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sales_records", sa.Column("created_by", sa.String(120), nullable=True))
    op.add_column("inventory_adjustments", sa.Column("created_by", sa.String(120), nullable=True))
    op.add_column("purchase_orders", sa.Column("created_by", sa.String(120), nullable=True))
    op.add_column("categories", sa.Column("name_en", sa.String(160), nullable=True))
    op.add_column("products", sa.Column("internal_code", sa.String(20), nullable=True))

    op.create_table(
        "audit_events",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger, sa.ForeignKey("stores.id"), nullable=False, index=True),
        sa.Column("user_name", sa.String(120), nullable=True),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("entity_type", sa.String(40), nullable=False),
        sa.Column("entity_id", sa.BigInteger, nullable=True),
        sa.Column("detail", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index("ix_audit_events_store_created", "audit_events", ["store_id", "created_at"])

    # Backfill internal codes per store: consumables CA0001…, retail PR0001…,
    # ordered by product id so the numbering is stable and human-guessable.
    conn = op.get_bind()
    rows = conn.execute(sa.text(
        "SELECT id, store_id, item_type FROM products ORDER BY store_id, id"
    )).fetchall()
    counters: dict[tuple[int, str], int] = {}
    for pid, store_id, item_type in rows:
        prefix = "CA" if item_type == "consumable" else "PR"
        n = counters.get((store_id, prefix), 0) + 1
        counters[(store_id, prefix)] = n
        conn.execute(
            sa.text("UPDATE products SET internal_code = :code WHERE id = :pid"),
            {"code": f"{prefix}{n:04d}", "pid": pid},
        )


def downgrade() -> None:
    op.drop_index("ix_audit_events_store_created", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_column("products", "internal_code")
    op.drop_column("categories", "name_en")
    op.drop_column("purchase_orders", "created_by")
    op.drop_column("inventory_adjustments", "created_by")
    op.drop_column("sales_records", "created_by")
