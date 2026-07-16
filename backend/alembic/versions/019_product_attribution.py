"""Attribution on products (review-improvements A3).

created_by / updated_by (display-name snapshots, mig 016 pattern) on
products so edits made from the new edit flow are attributable. Nullable —
rows written before this migration and dev-fallback writes stay NULL.

Revision ID: 019
Revises: 018
"""

from alembic import op
import sqlalchemy as sa

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("created_by", sa.String(120), nullable=True))
    op.add_column("products", sa.Column("updated_by", sa.String(120), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "updated_by")
    op.drop_column("products", "created_by")
