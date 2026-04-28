from tests.conftest import auth


def test_list_groups_empty(client, admin_token):
    resp = client.get("/api/ipgroups", headers=auth(admin_token))
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_group(client, admin_token):
    resp = client.post(
        "/api/ipgroups",
        json={"name": "DMZ", "ips": ["192.168.1.1", "192.168.1.2"]},
        headers=auth(admin_token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "DMZ"
    assert data["ips"] == ["192.168.1.1", "192.168.1.2"]
    assert "id" in data


def test_create_duplicate_group(client, admin_token):
    client.post("/api/ipgroups", json={"name": "DMZ", "ips": []}, headers=auth(admin_token))
    resp = client.post("/api/ipgroups", json={"name": "DMZ", "ips": []}, headers=auth(admin_token))
    assert resp.status_code == 409


def test_update_group(client, admin_token):
    group_id = client.post(
        "/api/ipgroups",
        json={"name": "OldName", "ips": ["1.1.1.1"]},
        headers=auth(admin_token),
    ).json()["id"]
    resp = client.put(
        f"/api/ipgroups/{group_id}",
        json={"name": "NewName", "ips": ["2.2.2.2"]},
        headers=auth(admin_token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "NewName"
    assert data["ips"] == ["2.2.2.2"]


def test_update_group_not_found(client, admin_token):
    resp = client.put("/api/ipgroups/9999", json={"name": "x"}, headers=auth(admin_token))
    assert resp.status_code == 404


def test_update_group_duplicate_name_conflict(client, admin_token):
    g1 = client.post(
        "/api/ipgroups",
        json={"name": "GroupA", "ips": ["1.1.1.1"]},
        headers=auth(admin_token),
    ).json()["id"]
    client.post(
        "/api/ipgroups",
        json={"name": "GroupB", "ips": ["2.2.2.2"]},
        headers=auth(admin_token),
    )
    resp = client.put(
        f"/api/ipgroups/{g1}",
        json={"name": "GroupB"},
        headers=auth(admin_token),
    )
    assert resp.status_code == 409


def test_delete_group(client, admin_token):
    group_id = client.post(
        "/api/ipgroups",
        json={"name": "ToDelete", "ips": []},
        headers=auth(admin_token),
    ).json()["id"]
    assert client.delete(f"/api/ipgroups/{group_id}", headers=auth(admin_token)).status_code == 204
    groups = client.get("/api/ipgroups", headers=auth(admin_token)).json()
    assert not any(g["id"] == group_id for g in groups)


def test_delete_group_not_found(client, admin_token):
    resp = client.delete("/api/ipgroups/9999", headers=auth(admin_token))
    assert resp.status_code == 404


def test_viewer_cannot_create_group(client, viewer_token):
    resp = client.post(
        "/api/ipgroups",
        json={"name": "Blocked", "ips": []},
        headers=auth(viewer_token),
    )
    assert resp.status_code == 403


def test_viewer_cannot_update_group(client, admin_token, viewer_token):
    group_id = client.post(
        "/api/ipgroups",
        json={"name": "Protected", "ips": []},
        headers=auth(admin_token),
    ).json()["id"]
    resp = client.put(f"/api/ipgroups/{group_id}", json={"name": "Hacked"}, headers=auth(viewer_token))
    assert resp.status_code == 403


def test_ipgroups_requires_auth(client):
    resp = client.get("/api/ipgroups")
    assert resp.status_code == 401
