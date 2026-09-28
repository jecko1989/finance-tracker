from app.core.security import hash_password
from app.models.user import User


def test_login_success(client, db_session):
    db_session.add(User(username="bob", password_hash=hash_password("hunter2")))
    db_session.commit()

    response = client.post("/auth/login", json={"username": "bob", "password": "hunter2"})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password(client, db_session):
    db_session.add(User(username="bob", password_hash=hash_password("hunter2")))
    db_session.commit()

    response = client.post("/auth/login", json={"username": "bob", "password": "wrong"})
    assert response.status_code == 401


def test_change_password_requires_old_password(client, auth_headers):
    response = client.post(
        "/auth/change-password",
        json={"old_password": "wrong", "new_password": "newpass"},
        headers=auth_headers,
    )
    assert response.status_code == 401


def test_change_password_success(client, auth_headers):
    response = client.post(
        "/auth/change-password",
        json={"old_password": "testpass", "new_password": "newpass"},
        headers=auth_headers,
    )
    assert response.status_code == 204

    login_response = client.post("/auth/login", json={"username": "testuser", "password": "newpass"})
    assert login_response.status_code == 200


def test_protected_endpoint_requires_token(client):
    response = client.post("/auth/change-password", json={"old_password": "a", "new_password": "b"})
    assert response.status_code in (401, 403)
