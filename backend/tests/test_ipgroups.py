"""Tests for /api/ipgroups/* endpoints."""


def test_list_ipgroups_empty(admin_client):
    resp = admin_client.get("/api/ipgroups")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_ipgroup(admin_client):
    resp = admin_client.post(
        "/api/ipgroups",
        json={"name": "Server Farm", "ips": ["10.0.0.1", "10.0.0.2", "10.0.0.3"]},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Server Farm"
    assert "10.0.0.1" in data["ips"]
    assert data["id"] is not None


def test_create_and_list_ipgroup(admin_client):
    admin_client.post("/api/ipgroups", json={"name": "Group A", "ips": ["1.1.1.1"]})
    admin_client.post("/api/ipgroups", json={"name": "Group B", "ips": ["2.2.2.2"]})
    resp = admin_client.get("/api/ipgroups")
    assert len(resp.json()) == 2


def test_create_ipgroup_duplicate_name(admin_client):
    admin_client.post("/api/ipgroups", json={"name": "Dup Group", "ips": ["1.1.1.1"]})
    resp = admin_client.post("/api/ipgroups", json={"name": "Dup Group", "ips": ["2.2.2.2"]})
    assert resp.status_code == 409


def test_delete_ipgroup(admin_client):
    group_id = admin_client.post(
        "/api/ipgroups", json={"name": "To Delete", "ips": []}
    ).json()["id"]
    resp = admin_client.delete(f"/api/ipgroups/{group_id}")
    assert resp.status_code == 204
    assert len(admin_client.get("/api/ipgroups").json()) == 0


def test_delete_ipgroup_not_found(admin_client):
    resp = admin_client.delete("/api/ipgroups/99999")
    assert resp.status_code == 404


def test_ipgroups_viewer_can_read(viewer_client):
    resp = viewer_client.get("/api/ipgroups")
    assert resp.status_code == 200


def test_ipgroups_unauthenticated(client):
    resp = client.get("/api/ipgroups")
    assert resp.status_code == 401
