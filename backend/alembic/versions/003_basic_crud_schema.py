"""basic CRUD schema additions for paylight X PoC

Revision ID: 003
Revises: 002
Create Date: 2026-05-12

Additive migration that brings the schema up to what the
03_basic_backend_implementation_prompt design brief expects:

  • categories  — color/icon, applies_to, default_tax_rate, description, sort_order
  • vendors     — postal_code, payment_terms, status, notes (contact already covered by contact_name/email/phone)
  • branches    — branch_type, postal_code, manager_name, operating_hours_json,
                  default_tax_rate, low_stock_threshold, status
  • support_tickets — new table for the サポート page
  • settings_kv     — new table holding per-namespace JSON blobs

Notes on what's intentionally NOT in this migration
  • Existing `products.item_type` enum keeps its current values (product, consumable);
    the brief calls them (retail, consumable), but our frontend, seed data, dashboard
    KPIs, and migration 002 all reference 'product'. Re-naming would break working
    code with no PoC benefit. Documented in CHANGES.md §13.
  • Existing PO and sales schemas already cover the demo path; the brief's larger
    refactor (po_number generation, transaction_id format, dedicated po_items/sales_items
    columns) is deferred to a future migration — existing models work end-to-end now.
"""

from alembic import op
import sqlalchemy as sa


revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── categories: hierarchy already has parent_id; add design metadata ──
    with op.batch_alter_table("categories") as batch:
        batch.add_column(sa.Column("color_hex", sa.String(7), nullable=True))
        batch.add_column(sa.Column("icon_name", sa.String(48), nullable=True))
        batch.add_column(sa.Column(
            "applies_to",
            sa.Enum("retail", "consumable", "both", name="cat_applies_enum"),
            nullable=False, server_default="both",
        ))
        batch.add_column(sa.Column(
            "default_tax_rate", sa.Numeric(4, 2),
            nullable=False, server_default="10.00",
        ))
        batch.add_column(sa.Column("description", sa.Text(), nullable=True))
        batch.add_column(sa.Column(
            "sort_order", sa.Integer(), nullable=False, server_default="0",
        ))

    # ── vendors: extra contact + status fields the design needs ──
    with op.batch_alter_table("vendors") as batch:
        batch.add_column(sa.Column("postal_code", sa.String(8), nullable=True))
        batch.add_column(sa.Column("payment_terms", sa.String(128), nullable=True))
        batch.add_column(sa.Column(
            "status",
            sa.Enum("active", "inactive", name="vendor_status_enum"),
            nullable=False, server_default="active",
        ))
        batch.add_column(sa.Column("notes", sa.Text(), nullable=True))

    # ── branches: operational details ──
    with op.batch_alter_table("branches") as batch:
        batch.add_column(sa.Column(
            "branch_type",
            sa.Enum("main", "sub", name="branch_type_enum"),
            nullable=False, server_default="main",
        ))
        batch.add_column(sa.Column("postal_code", sa.String(8), nullable=True))
        batch.add_column(sa.Column("manager_name", sa.String(128), nullable=True))
        batch.add_column(sa.Column("operating_hours_json", sa.JSON(), nullable=True))
        batch.add_column(sa.Column(
            "default_tax_rate", sa.Numeric(4, 2),
            nullable=False, server_default="10.00",
        ))
        batch.add_column(sa.Column(
            "low_stock_threshold", sa.Integer(),
            nullable=False, server_default="10",
        ))
        batch.add_column(sa.Column(
            "status",
            sa.Enum("active", "inactive", name="branch_status_enum"),
            nullable=False, server_default="active",
        ))

    # ── support_tickets ──
    op.create_table(
        "support_tickets",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger(),
                  sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("subject_category",
                  sa.Enum("bug", "feature", "howto", "other",
                          name="support_subject_enum"),
                  nullable=False),
        sa.Column("related_page", sa.String(64), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("contact_window", sa.String(64), nullable=True),
        sa.Column("status",
                  sa.Enum("open", "in_progress", "resolved",
                          name="ticket_status_enum"),
                  nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_support_tickets_store_id", "support_tickets", ["store_id"])

    # ── settings_kv (one row per (store_id, namespace)) ──
    op.create_table(
        "settings_kv",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger(),
                  sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("namespace", sa.String(32), nullable=False),
        sa.Column("data_json", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("CURRENT_TIMESTAMP"),
                  onupdate=sa.text("CURRENT_TIMESTAMP"),
                  nullable=False),
        sa.UniqueConstraint("store_id", "namespace", name="uq_settings_store_ns"),
    )


def downgrade() -> None:
    op.drop_table("settings_kv")
    op.drop_index("ix_support_tickets_store_id", table_name="support_tickets")
    op.drop_table("support_tickets")

    with op.batch_alter_table("branches") as batch:
        batch.drop_column("status")
        batch.drop_column("low_stock_threshold")
        batch.drop_column("default_tax_rate")
        batch.drop_column("operating_hours_json")
        batch.drop_column("manager_name")
        batch.drop_column("postal_code")
        batch.drop_column("branch_type")

    with op.batch_alter_table("vendors") as batch:
        batch.drop_column("notes")
        batch.drop_column("status")
        batch.drop_column("payment_terms")
        batch.drop_column("postal_code")

    with op.batch_alter_table("categories") as batch:
        batch.drop_column("sort_order")
        batch.drop_column("description")
        batch.drop_column("default_tax_rate")
        batch.drop_column("applies_to")
        batch.drop_column("icon_name")
        batch.drop_column("color_hex")
    # MySQL inlines enums; no separate types to drop.
