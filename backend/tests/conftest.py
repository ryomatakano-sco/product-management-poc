"""Test net (review-improvements C2).

Runs against a dedicated MySQL schema `product_management_test` on the same
local server as dev — NOT SQLite, because services/stock.py (and other hot
paths) use MySQL-flavored raw SQL (`INSERT IGNORE`, `CONVERT_TZ`-style
functions) that SQLite cannot parse. The schema is created on demand and
fully truncated + reseeded before every test.

Safety: this file refuses to run if the resolved URL is not the test schema
(the real dental-clinic `maindb` on this server must never be touched).
"""

import os

# Must be set BEFORE any `app.*` import — app.db builds its engine at import
# time from the resolved URL, and MOCK_AI keeps every AI path off OpenAI.
TEST_DB = "product_management_test"
os.environ["DATABASE_URL"] = f"mysql+aiomysql://root:admin@127.0.0.1:3306/{TEST_DB}"
os.environ["MOCK_AI"] = "1"

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings

assert TEST_DB in settings.resolved_database_url, settings.resolved_database_url
assert "maindb" not in settings.resolved_database_url, "refusing to run tests against maindb"

from app.db import async_session, engine  # noqa: E402
from app.models import (  # noqa: E402
    Base, Branch, Category, Store, User, Vendor,
)
from app.models.user import UserRole  # noqa: E402


@pytest_asyncio.fixture(scope="session")
async def _database():
    """Create the test schema + tables once per test session."""
    server = create_async_engine("mysql+aiomysql://root:admin@127.0.0.1:3306", isolation_level="AUTOCOMMIT")
    async with server.connect() as conn:
        await conn.execute(text(
            f"CREATE DATABASE IF NOT EXISTS {TEST_DB} "
            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        ))
    await server.dispose()

    async with engine.begin() as conn:
        await conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        # Manual drops: drop_all's topological sort chokes on the
        # products ↔ ai_suggestion_sessions FK cycle.
        for table in Base.metadata.tables.values():
            await conn.execute(text(f"DROP TABLE IF EXISTS {table.name}"))
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
    yield
    await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def seeded(_database):
    """Truncate everything and seed the baseline fixtures for each test.

    Baseline: two stores (tenancy tests), one main branch each, a vendor +
    category in store 1, and an admin + staff login in store 1.
    """
    async with engine.begin() as conn:
        await conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        # tables.values(), not sorted_tables — the products ↔
        # ai_suggestion_sessions FK cycle makes topological sort raise, and
        # order is irrelevant with FK checks off.
        for table in Base.metadata.tables.values():
            await conn.execute(text(f"TRUNCATE TABLE {table.name}"))
        await conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))

    from app.services.auth import hash_password

    async with async_session() as db:
        db.add_all([Store(id=1, name="テスト本店"), Store(id=2, name="第二テスト店")])
        await db.flush()
        db.add_all([
            Branch(id=1, store_id=1, name="本院", is_default=True),
            Branch(id=2, store_id=2, name="本院", is_default=True),
            Vendor(id=1, store_id=1, company_name="テスト商会"),
            Category(id=1, store_id=1, name="ケア用品"),
            User(store_id=1, email="admin@test.example", display_name="テスト管理者",
                 password_hash=hash_password("admin-pw"), role=UserRole.admin),
            User(store_id=1, email="staff@test.example", display_name="テストスタッフ",
                 password_hash=hash_password("staff-pw"), role=UserRole.staff),
        ])
        await db.commit()


def _make_client(**kwargs):
    from app.main import app
    transport = ASGITransport(app=app, client=kwargs.pop("client_addr", ("127.0.0.1", 12345)))
    return AsyncClient(transport=transport, base_url="http://testserver", **kwargs)


@pytest_asyncio.fixture
async def client():
    """Loopback client on the X-Store-Id dev path, store 1."""
    async with _make_client(headers={"X-Store-Id": "1"}) as c:
        yield c


@pytest_asyncio.fixture
async def client_store2():
    async with _make_client(headers={"X-Store-Id": "2"}) as c:
        yield c


@pytest_asyncio.fixture
async def anon_client():
    """Loopback client with no auth at all."""
    async with _make_client() as c:
        yield c


@pytest_asyncio.fixture
async def remote_client():
    """Simulates a non-loopback caller — the dev header must be rejected."""
    async with _make_client(client_addr=("203.0.113.9", 51000)) as c:
        yield c


async def create_product(client, name="テスト歯ブラシ", on_hand=0, **extra):
    """Helper: create a product with one default variant, return the JSON."""
    body = {
        "name": name,
        "status": "active",
        "item_type": "product",
        "variants": [{
            "sku": extra.pop("sku", None),
            "price": "500",
            "on_hand": on_hand,
            "is_default": True,
            "low_stock_threshold": 5,
        }],
        **extra,
    }
    r = await client.post("/products", json=body)
    assert r.status_code == 201, r.text
    return r.json()
