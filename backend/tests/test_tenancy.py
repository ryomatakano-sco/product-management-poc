"""Auth + tenancy rules (deps.get_store_id): the guards that protect real
store data. Covers the loopback-only X-Store-Id dev fallback and cross-store
isolation."""

from tests.conftest import create_product


async def test_no_auth_is_rejected(anon_client):
    r = await anon_client.get("/products")
    assert r.status_code == 400


async def test_dev_header_works_from_loopback(client):
    r = await client.get("/products")
    assert r.status_code == 200


async def test_dev_header_rejected_from_remote(remote_client):
    r = await remote_client.get("/products", headers={"X-Store-Id": "1"})
    assert r.status_code == 401


async def test_login_sets_session_cookie(anon_client):
    r = await anon_client.post("/auth/login", json={
        "email": "admin@test.example", "password": "admin-pw",
    })
    assert r.status_code == 200, r.text
    assert "plx_session" in r.cookies
    me = await anon_client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["display_name"] == "テスト管理者"


async def test_wrong_password_rejected(anon_client):
    r = await anon_client.post("/auth/login", json={
        "email": "admin@test.example", "password": "wrong",
    })
    assert r.status_code in (400, 401)


async def test_cross_store_isolation(client, client_store2):
    created = await create_product(client, name="店1の商品")
    pid = created["id"]

    # Store 2 must not see store 1's product — by id or in the list.
    r = await client_store2.get(f"/products/{pid}")
    assert r.status_code == 404
    r = await client_store2.get("/products")
    assert r.status_code == 200
    names = [p["name"] for p in r.json()["items"]]
    assert "店1の商品" not in names


async def test_cross_store_write_blocked(client, client_store2):
    created = await create_product(client)
    pid = created["id"]
    r = await client_store2.patch(f"/products/{pid}", json={"name": "乗っ取り"})
    assert r.status_code == 404
    # And the original is untouched.
    r = await client.get(f"/products/{pid}")
    assert r.json()["name"] == "テスト歯ブラシ"
