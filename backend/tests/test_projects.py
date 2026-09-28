from datetime import date
from decimal import Decimal

from app.core.security import hash_password
from app.models.project import Project
from app.models.transaction import Transaction
from app.models.user import User


def test_create_and_list_projects(client, auth_headers):
    response = client.post("/projects", json={"name": "Portafoglio personale"}, headers=auth_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Portafoglio personale"
    assert body["balance"] == "0"

    response = client.get("/projects", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_update_project_name(client, auth_headers):
    create = client.post("/projects", json={"name": "Vecchio nome"}, headers=auth_headers)
    project_id = create.json()["id"]

    response = client.patch(f"/projects/{project_id}", json={"name": "Nuovo nome"}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Nuovo nome"


def test_delete_project_also_deletes_its_transactions(client, db_session, auth_headers):
    create = client.post("/projects", json={"name": "Da eliminare"}, headers=auth_headers)
    project_id = create.json()["id"]

    db_session.add(Transaction(project_id=project_id, amount=Decimal("10.00"), date=date(2026, 1, 1)))
    db_session.commit()

    response = client.delete(f"/projects/{project_id}", headers=auth_headers)
    assert response.status_code == 204

    response = client.get("/projects", headers=auth_headers)
    assert response.json() == []

    # Re-query with a fresh statement (not the session's identity map) to make sure
    # the cascade actually removed the row from the database, not just from ORM state.
    remaining = db_session.query(Transaction).filter(Transaction.project_id == project_id).all()
    assert remaining == []


def test_project_not_visible_or_editable_by_another_user(client, db_session, auth_headers):
    other_user = User(username="other", password_hash=hash_password("pass"))
    db_session.add(other_user)
    db_session.commit()
    other_project = Project(owner_id=other_user.id, name="Non tuo")
    db_session.add(other_project)
    db_session.commit()

    response = client.get(f"/projects/{other_project.id}", headers=auth_headers)
    assert response.status_code == 404

    response = client.patch(f"/projects/{other_project.id}", json={"name": "x"}, headers=auth_headers)
    assert response.status_code == 404

    response = client.delete(f"/projects/{other_project.id}", headers=auth_headers)
    assert response.status_code == 404
