"""FULLTEXT search index on products

Revision ID: 004
Revises: 003
Create Date: 2026-05-18

Adds a MySQL FULLTEXT index covering (name, name_kana, description) so the
product list page can use MATCH ... AGAINST instead of unindexed ILIKE scans.

Notes
  • Requires InnoDB on MySQL 5.7+ (we're on 8). Charset is already utf8mb4
    (set globally on Base.__table_args__), which FULLTEXT supports.
  • The default ngram parser is OFF; we use the default tokenizer which
    treats whitespace + CJK characters appropriately for our mix of Japanese
    + alphanumeric SKU codes. The router falls back to ILIKE for short
    queries below MySQL's ft_min_word_len (default 4 for the default parser,
    3 for innodb_ft_min_token_size). This keeps "GUM" / "Ora" working.
  • Backfill is automatic on existing rows — InnoDB rebuilds the index
    inline when the DDL runs. With the PoC's tiny seed dataset this is
    instant; on a real DB sized for a clinic it would take minutes, not
    hours.

Downgrade drops the index. Nothing data-destructive.
"""

from alembic import op


revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


# Pure DDL — keep the SQL inline so we don't accidentally depend on a
# SQLAlchemy version that emits FULLTEXT differently.
CREATE_FULLTEXT = (
    "CREATE FULLTEXT INDEX ft_products_name_kana_desc "
    "ON products (name, name_kana, description)"
)
DROP_FULLTEXT = "DROP INDEX ft_products_name_kana_desc ON products"


def upgrade() -> None:
    bind = op.get_bind()
    # Guard: skip silently on SQLite (used by tests in some setups). MySQL
    # is the only target that supports FULLTEXT here.
    if bind.dialect.name != "mysql":
        return
    op.execute(CREATE_FULLTEXT)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "mysql":
        return
    op.execute(DROP_FULLTEXT)
