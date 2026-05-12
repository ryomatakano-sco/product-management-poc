"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE_KWARGS = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}


def upgrade() -> None:
    # --- stores ---
    op.create_table(
        "stores",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        **TABLE_KWARGS,
    )

    # --- branches ---
    op.create_table(
        "branches",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger, sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("contact_name", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("website", sa.String(500), nullable=True),
        sa.Column("is_default", sa.Boolean, default=False, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        **TABLE_KWARGS,
    )
    op.create_index("ix_branches_store_id", "branches", ["store_id"])

    # --- vendors ---
    op.create_table(
        "vendors",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger, sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("contact_name", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("website", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        **TABLE_KWARGS,
    )
    op.create_index("ix_vendors_store_id", "vendors", ["store_id"])

    # --- categories ---
    op.create_table(
        "categories",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger, sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("name_kana", sa.String(255), nullable=True),
        sa.Column("parent_id", sa.BigInteger, sa.ForeignKey("categories.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        **TABLE_KWARGS,
    )
    op.create_index("ix_categories_store_id", "categories", ["store_id"])
    op.create_index("ix_categories_store_parent", "categories", ["store_id", "parent_id"])

    # --- ai_suggestion_sessions (must exist before products FK) ---
    op.create_table(
        "ai_suggestion_sessions",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger, sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("input_jan", sa.String(50), nullable=True),
        sa.Column("input_title", sa.String(500), nullable=True),
        sa.Column("status", sa.Enum("pending", "completed", "failed", name="ai_session_status"), default="pending", nullable=False),
        sa.Column("model_name", sa.String(100), nullable=False),
        sa.Column("raw_agent_log", sa.Text, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("applied_to_product_id", sa.BigInteger, nullable=True),
        # FK to products added after products table is created
        **TABLE_KWARGS,
    )
    op.create_index("ix_ai_sessions_store", "ai_suggestion_sessions", ["store_id"])

    # --- products (superset of goods) ---
    op.create_table(
        "products",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger, sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("category_id", sa.BigInteger, sa.ForeignKey("categories.id"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        # Legacy columns from `goods` — DO NOT RENAME
        sa.Column("default_amount_at_payment", sa.Numeric(10, 2), nullable=True, comment="Legacy: default price"),
        sa.Column("is_insurable", sa.Boolean, default=False, nullable=False),
        sa.Column("is_pinned", sa.Boolean, default=False, nullable=False),
        sa.Column("default_insurance_point_at_payment", sa.Numeric(10, 2), nullable=True, comment="Legacy: insurance point value"),
        # New columns
        sa.Column("name_kana", sa.String(255), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("vendor_id", sa.BigInteger, sa.ForeignKey("vendors.id"), nullable=True),
        sa.Column("country_of_origin", sa.String(100), nullable=True),
        sa.Column("status", sa.Enum("active", "draft", "archived", name="product_status"), default="active", nullable=False),
        sa.Column("ai_session_id", sa.BigInteger, sa.ForeignKey("ai_suggestion_sessions.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        **TABLE_KWARGS,
    )
    op.create_index("ix_products_store_status", "products", ["store_id", "status"])
    op.create_index("ix_products_store_vendor", "products", ["store_id", "vendor_id"])
    op.create_index("ix_products_store_category", "products", ["store_id", "category_id"])

    # Now add the FK from ai_suggestion_sessions.applied_to_product_id -> products.id
    op.create_foreign_key(
        "fk_ai_sessions_product",
        "ai_suggestion_sessions",
        "products",
        ["applied_to_product_id"],
        ["id"],
    )

    # --- product_variants ---
    op.create_table(
        "product_variants",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("product_id", sa.BigInteger, sa.ForeignKey("products.id"), nullable=False),
        sa.Column("store_id", sa.BigInteger, sa.ForeignKey("stores.id"), nullable=False, comment="Denormalized for tenancy queries"),
        sa.Column("sku", sa.String(100), nullable=True),
        sa.Column("barcode", sa.String(100), nullable=True, comment="JAN code goes here"),
        sa.Column("option1_name", sa.String(100), nullable=True),
        sa.Column("option1_value", sa.String(255), nullable=True),
        sa.Column("option2_name", sa.String(100), nullable=True),
        sa.Column("option2_value", sa.String(255), nullable=True),
        sa.Column("option3_name", sa.String(100), nullable=True),
        sa.Column("option3_value", sa.String(255), nullable=True),
        sa.Column("price", sa.Numeric(10, 2), nullable=True),
        sa.Column("cost", sa.Numeric(10, 2), nullable=True),
        sa.Column("weight_value", sa.Numeric(10, 3), nullable=True),
        sa.Column("weight_unit", sa.Enum("g", "kg", name="weight_unit"), default="g", nullable=False),
        sa.Column("on_hand", sa.Integer, default=0, nullable=False),
        sa.Column("committed", sa.Integer, default=0, nullable=False),
        sa.Column("unavailable", sa.Integer, default=0, nullable=False),
        sa.Column("is_default", sa.Boolean, default=False, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        **TABLE_KWARGS,
    )
    op.create_index("ix_variants_store_sku", "product_variants", ["store_id", "sku"], unique=True)
    op.create_index("ix_variants_store_barcode", "product_variants", ["store_id", "barcode"], unique=True)
    op.create_index("ix_variants_product", "product_variants", ["product_id"])

    # --- product_images ---
    op.create_table(
        "product_images",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("product_id", sa.BigInteger, sa.ForeignKey("products.id"), nullable=False),
        sa.Column("store_id", sa.BigInteger, sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("url", sa.String(2000), nullable=False),
        sa.Column("alt_text", sa.String(500), nullable=True),
        sa.Column("position", sa.Integer, default=0, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        **TABLE_KWARGS,
    )
    op.create_index("ix_product_images_product", "product_images", ["product_id"])

    # --- tags ---
    op.create_table(
        "tags",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger, sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("store_id", "name", name="uq_tags_store_name"),
        **TABLE_KWARGS,
    )
    op.create_index("ix_tags_store_id", "tags", ["store_id"])

    # --- product_tags ---
    op.create_table(
        "product_tags",
        sa.Column("product_id", sa.BigInteger, sa.ForeignKey("products.id"), primary_key=True),
        sa.Column("tag_id", sa.BigInteger, sa.ForeignKey("tags.id"), primary_key=True),
        **TABLE_KWARGS,
    )

    # --- inventory_adjustments ---
    op.create_table(
        "inventory_adjustments",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger, sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("variant_id", sa.BigInteger, sa.ForeignKey("product_variants.id"), nullable=False),
        sa.Column("field", sa.Enum("on_hand", "committed", "unavailable", name="inventory_field"), nullable=False),
        sa.Column("delta", sa.Integer, nullable=False, comment="Signed: +N or -N"),
        sa.Column("reason", sa.Enum("manual", "sale", "purchase_order_received", "correction", "damage", "other", name="adjustment_reason"), nullable=False),
        sa.Column("reference_type", sa.String(50), nullable=True),
        sa.Column("reference_id", sa.BigInteger, nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        **TABLE_KWARGS,
    )
    op.create_index("ix_inv_adj_store_variant", "inventory_adjustments", ["store_id", "variant_id"])

    # --- sales_records ---
    op.create_table(
        "sales_records",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger, sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("branch_id", sa.BigInteger, sa.ForeignKey("branches.id"), nullable=False),
        sa.Column("variant_id", sa.BigInteger, sa.ForeignKey("product_variants.id"), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("sold_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("patient_ref", sa.String(255), nullable=True, comment="Placeholder for future patient linking"),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        **TABLE_KWARGS,
    )
    op.create_index("ix_sales_store_variant_date", "sales_records", ["store_id", "variant_id", "sold_at"])

    # --- purchase_orders ---
    op.create_table(
        "purchase_orders",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger, sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("supplier_vendor_id", sa.BigInteger, sa.ForeignKey("vendors.id"), nullable=False),
        sa.Column("destination_branch_id", sa.BigInteger, sa.ForeignKey("branches.id"), nullable=False),
        sa.Column("status", sa.Enum("draft", "ordered", "partially_received", "received", "cancelled", name="po_status"), default="draft", nullable=False),
        sa.Column("payment_terms", sa.String(255), nullable=True),
        sa.Column("estimated_arrival", sa.Date, nullable=True),
        sa.Column("shipping_carrier", sa.String(255), nullable=True),
        sa.Column("tracking_number", sa.String(255), nullable=True),
        sa.Column("reference_number", sa.String(255), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("subtotal", sa.Numeric(12, 2), default=0, nullable=False),
        sa.Column("shipping_cost", sa.Numeric(10, 2), default=0, nullable=False),
        sa.Column("total", sa.Numeric(12, 2), default=0, nullable=False),
        sa.Column("ordered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        **TABLE_KWARGS,
    )
    op.create_index("ix_po_store_status", "purchase_orders", ["store_id", "status"])
    op.create_index("ix_po_store_supplier", "purchase_orders", ["store_id", "supplier_vendor_id"])

    # --- purchase_order_items ---
    op.create_table(
        "purchase_order_items",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("purchase_order_id", sa.BigInteger, sa.ForeignKey("purchase_orders.id"), nullable=False),
        sa.Column("store_id", sa.BigInteger, sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("variant_id", sa.BigInteger, sa.ForeignKey("product_variants.id"), nullable=False),
        sa.Column("quantity_ordered", sa.Integer, nullable=False),
        sa.Column("quantity_received", sa.Integer, default=0, nullable=False),
        sa.Column("unit_cost", sa.Numeric(10, 2), nullable=False),
        sa.Column("line_total", sa.Numeric(12, 2), nullable=False),
        **TABLE_KWARGS,
    )
    op.create_index("ix_po_items_po", "purchase_order_items", ["purchase_order_id"])

    # --- purchase_order_tags ---
    op.create_table(
        "purchase_order_tags",
        sa.Column("purchase_order_id", sa.BigInteger, sa.ForeignKey("purchase_orders.id"), primary_key=True),
        sa.Column("tag_id", sa.BigInteger, sa.ForeignKey("tags.id"), primary_key=True),
        **TABLE_KWARGS,
    )

    # --- ai_suggestion_field_options ---
    op.create_table(
        "ai_suggestion_field_options",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.BigInteger, sa.ForeignKey("ai_suggestion_sessions.id"), nullable=False),
        sa.Column("field_name", sa.String(50), nullable=False, comment="e.g. title, description, brand, category"),
        sa.Column("value_text", sa.Text, nullable=False, comment="Always text; JSON-encode lists"),
        sa.Column("source_url", sa.String(2000), nullable=True),
        sa.Column("source_title", sa.String(500), nullable=True),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("position", sa.Integer, nullable=False, comment="Display order, lower = better"),
        sa.Column("was_applied", sa.Boolean, default=False, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        **TABLE_KWARGS,
    )
    op.create_index("ix_ai_options_session", "ai_suggestion_field_options", ["session_id"])


def downgrade() -> None:
    op.drop_table("ai_suggestion_field_options")
    op.drop_table("purchase_order_tags")
    op.drop_table("purchase_order_items")
    op.drop_table("purchase_orders")
    op.drop_table("sales_records")
    op.drop_table("inventory_adjustments")
    op.drop_table("product_tags")
    op.drop_table("tags")
    op.drop_table("product_images")
    op.drop_table("product_variants")
    op.drop_constraint("fk_ai_sessions_product", "ai_suggestion_sessions", type_="foreignkey")
    op.drop_table("products")
    op.drop_table("ai_suggestion_sessions")
    op.drop_table("categories")
    op.drop_table("vendors")
    op.drop_table("branches")
    op.drop_table("stores")
