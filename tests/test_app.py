"""
Tests for the Forestry Asset Management application.
"""

import pytest
from app import create_app, db, Asset


@pytest.fixture
def client():
    """Create a test client with an isolated in-memory database."""
    test_app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    with test_app.app_context():
        yield test_app.test_client()
        db.drop_all()


# ── Helpers ────────────────────────────────────────────────────────────────

def post_asset(client, **kwargs):
    data = {
        "name": "Test Chainsaw",
        "category": "tool",
        "asset_type": "chainsaw",
        **kwargs,
    }
    return client.post("/api/assets", json=data)


# ── List / Stats ────────────────────────────────────────────────────────────

def test_list_assets_empty(client):
    res = client.get("/api/assets")
    assert res.status_code == 200
    assert res.get_json() == []


def test_stats_empty(client):
    res = client.get("/api/stats")
    assert res.status_code == 200
    data = res.get_json()
    assert data["total"] == 0
    assert data["by_category"]["tool"] == 0
    assert data["by_category"]["machine"] == 0


# ── Create ──────────────────────────────────────────────────────────────────

def test_create_asset_success(client):
    res = post_asset(client, serial_number="SN-001", status="available", location="Depot A")
    assert res.status_code == 201
    data = res.get_json()
    assert data["name"] == "Test Chainsaw"
    assert data["category"] == "tool"
    assert data["status"] == "available"
    assert data["location"] == "Depot A"
    assert data["id"] is not None


def test_create_machine(client):
    res = post_asset(client, name="Big Harvester", category="machine", asset_type="harvester")
    assert res.status_code == 201
    data = res.get_json()
    assert data["category"] == "machine"


def test_create_asset_missing_name(client):
    res = client.post("/api/assets", json={"category": "tool", "asset_type": "axe"})
    assert res.status_code == 400
    assert "name" in res.get_json()["error"]


def test_create_asset_invalid_category(client):
    res = client.post("/api/assets", json={"name": "X", "category": "robot", "asset_type": "axe"})
    assert res.status_code == 400
    assert "category" in res.get_json()["error"]


def test_create_asset_invalid_status(client):
    res = client.post(
        "/api/assets",
        json={"name": "X", "category": "tool", "asset_type": "axe", "status": "lost"},
    )
    assert res.status_code == 400
    assert "status" in res.get_json()["error"]


def test_create_duplicate_serial(client):
    post_asset(client, serial_number="DUP-001")
    res = post_asset(client, name="Another Chainsaw", serial_number="DUP-001")
    assert res.status_code == 409
    assert "serial_number" in res.get_json()["error"]


# ── Read ────────────────────────────────────────────────────────────────────

def test_get_asset(client):
    created = post_asset(client).get_json()
    res = client.get(f"/api/assets/{created['id']}")
    assert res.status_code == 200
    assert res.get_json()["id"] == created["id"]


def test_get_asset_not_found(client):
    res = client.get("/api/assets/9999")
    assert res.status_code == 404


# ── Update ──────────────────────────────────────────────────────────────────

def test_update_asset(client):
    created = post_asset(client).get_json()
    res = client.put(
        f"/api/assets/{created['id']}",
        json={"name": "Updated Chainsaw", "category": "tool", "asset_type": "chainsaw",
              "status": "in_use", "location": "Section D"},
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["name"] == "Updated Chainsaw"
    assert data["status"] == "in_use"
    assert data["location"] == "Section D"


def test_update_asset_not_found(client):
    res = client.put("/api/assets/9999", json={"status": "available"})
    assert res.status_code == 404


# ── Delete ──────────────────────────────────────────────────────────────────

def test_delete_asset(client):
    created = post_asset(client).get_json()
    res = client.delete(f"/api/assets/{created['id']}")
    assert res.status_code == 200
    assert client.get(f"/api/assets/{created['id']}").status_code == 404


def test_delete_asset_not_found(client):
    res = client.delete("/api/assets/9999")
    assert res.status_code == 404


# ── Patch Status ────────────────────────────────────────────────────────────

def test_patch_status(client):
    created = post_asset(client).get_json()
    res = client.patch(
        f"/api/assets/{created['id']}/status",
        json={"status": "maintenance"},
    )
    assert res.status_code == 200
    assert res.get_json()["status"] == "maintenance"


def test_patch_status_invalid(client):
    created = post_asset(client).get_json()
    res = client.patch(
        f"/api/assets/{created['id']}/status",
        json={"status": "broken"},
    )
    assert res.status_code == 400


# ── Filter ──────────────────────────────────────────────────────────────────

def test_filter_by_category(client):
    post_asset(client, name="Tool A", category="tool", asset_type="axe")
    post_asset(client, name="Machine B", category="machine", asset_type="forwarder")
    res = client.get("/api/assets?category=tool")
    data = res.get_json()
    assert all(a["category"] == "tool" for a in data)
    assert len(data) == 1


def test_filter_by_status(client):
    post_asset(client, name="A", status="available")
    post_asset(client, name="B", status="in_use")
    res = client.get("/api/assets?status=available")
    data = res.get_json()
    assert all(a["status"] == "available" for a in data)


# ── Stats accuracy ──────────────────────────────────────────────────────────

def test_stats_count(client):
    post_asset(client, name="Tool 1", category="tool",    asset_type="axe",       status="available")
    post_asset(client, name="Mach 1", category="machine", asset_type="harvester", status="in_use")
    post_asset(client, name="Tool 2", category="tool",    asset_type="saw",       status="maintenance")
    res = client.get("/api/stats")
    data = res.get_json()
    assert data["total"] == 3
    assert data["by_category"]["tool"] == 2
    assert data["by_category"]["machine"] == 1
    assert data["by_status"]["available"] == 1
    assert data["by_status"]["in_use"] == 1
    assert data["by_status"]["maintenance"] == 1


# ── Index route ─────────────────────────────────────────────────────────────

def test_index_route(client):
    res = client.get("/")
    assert res.status_code == 200
    assert b"Forestry Asset Manager" in res.data
