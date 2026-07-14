"""Users table for PoC session-cookie auth

Revision ID: 011
Revises: 010
Create Date: 2026-07-09

Adds ``users`` — the foundation for login, the Settings ユーザー管理 pane, and
(eventually) replacing the client-trusted ``X-Store-Id`` header with a server-
derived store id.

PoC choices (documented, revisit before production):
  • Passwords hashed with stdlib ``hashlib.scrypt`` (no new dependency).
  • Sessions are stateless HMAC-signed cookies (services/auth.py) — no sessions
    table; restarting the server does NOT log users out because the signing
    secret is a fixed dev value in config.py.
  • A dev admin is inserted here so EXISTING seeded databases get a login
    without re-seeding:  admin@example.com / admin   (scrypt hash embedded).
"""

from alembic import op
import sqlalchemy as sa


revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None

# scrypt hash of "admin" with a fixed salt (see services/auth.py for the format).
_DEV_ADMIN_HASH = (
    "scrypt$o/HC1OW2l4gRIjNEVWZ38A==$"
    "2zJXs76b9Ymsk983vkcwg7sqoHHMAnWB2bkoL1xYqWsyQVDUkbwAiML0JYFjDtQpEbjS8hvcJXUjZB8hwrlCQw=="
)


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger(),
                  sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("role",
                  sa.Enum("admin", "staff", name="user_role_enum"),
                  nullable=False, server_default="staff"),
        sa.Column("status",
                  sa.Enum("active", "inactive", name="user_status_enum"),
                  nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
                  nullable=False),
    )
    op.create_index("ix_users_store_id", "users", ["store_id"])

    # Dev admin for every existing store (idempotent for fresh DBs too —
    # seed.py also creates it, guarded by the unique email per store loop).
    op.execute(
        "INSERT INTO users (store_id, email, password_hash, display_name, role, status) "
        "SELECT s.id, CONCAT('admin', IF(s.id=1, '', s.id), '@example.com'), "
        f"'{_DEV_ADMIN_HASH}', '山田 花子', 'admin', 'active' FROM stores s"
    )


def downgrade() -> None:
    op.drop_table("users")
