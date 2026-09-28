def test_recent_transactions_aggregates_across_projects(client, auth_headers):
    p1 = client.post("/projects", json={"name": "Progetto 1"}, headers=auth_headers).json()["id"]
    p2 = client.post("/projects", json={"name": "Progetto 2"}, headers=auth_headers).json()["id"]

    client.post(
        f"/projects/{p1}/transactions",
        json={"amount": "10.00", "date": "2026-01-01", "note": "a"},
        headers=auth_headers,
    )
    client.post(
        f"/projects/{p2}/transactions",
        json={"amount": "20.00", "date": "2026-01-02", "note": "b"},
        headers=auth_headers,
    )

    response = client.get("/dashboard/recent", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    # most recent date first
    assert body[0]["note"] == "b"
    assert body[0]["project_name"] == "Progetto 2"


def test_recent_transactions_respects_limit(client, auth_headers):
    project_id = client.post("/projects", json={"name": "p"}, headers=auth_headers).json()["id"]
    for day in range(1, 6):
        client.post(
            f"/projects/{project_id}/transactions",
            json={"amount": "1.00", "date": f"2026-01-0{day}"},
            headers=auth_headers,
        )

    response = client.get("/dashboard/recent", params={"limit": 3}, headers=auth_headers)
    assert len(response.json()) == 3


def test_recent_transactions_empty_when_no_projects(client, auth_headers):
    response = client.get("/dashboard/recent", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_recent_transactions_excludes_other_users_data(client, db_session, auth_headers):
    from datetime import date
    from decimal import Decimal

    from app.core.security import hash_password
    from app.models.project import Project
    from app.models.transaction import Transaction
    from app.models.user import User

    other_user = User(username="other3", password_hash=hash_password("pass"))
    db_session.add(other_user)
    db_session.commit()
    other_project = Project(owner_id=other_user.id, name="Non tuo")
    db_session.add(other_project)
    db_session.commit()
    db_session.add(
        Transaction(project_id=other_project.id, amount=Decimal("99.00"), date=date(2026, 1, 1))
    )
    db_session.commit()

    response = client.get("/dashboard/recent", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []
