from app.core.security import hash_password
from app.models.project import Project
from app.models.user import User


def _create_project(client, auth_headers, name="Test"):
    response = client.post("/projects", json={"name": name}, headers=auth_headers)
    return response.json()["id"]


def test_create_and_list_transactions(client, auth_headers):
    project_id = _create_project(client, auth_headers)

    response = client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "100.00", "date": "2026-01-05", "note": "Stipendio", "category": "reddito"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["amount"] == "100.00"

    response = client.get(f"/projects/{project_id}/transactions", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_amount_is_quantized_to_two_decimals(client, auth_headers):
    project_id = _create_project(client, auth_headers)

    response = client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "10.999", "date": "2026-01-01"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["amount"] == "11.00"


def test_filter_transactions_by_date_and_category(client, auth_headers):
    project_id = _create_project(client, auth_headers)
    client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "50.00", "date": "2026-01-01", "category": "affitto"},
        headers=auth_headers,
    )
    client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "20.00", "date": "2026-02-01", "category": "cibo"},
        headers=auth_headers,
    )

    response = client.get(
        f"/projects/{project_id}/transactions",
        params={"category": "affitto"},
        headers=auth_headers,
    )
    assert len(response.json()) == 1
    assert response.json()[0]["category"] == "affitto"

    response = client.get(
        f"/projects/{project_id}/transactions",
        params={"from_date": "2026-02-01"},
        headers=auth_headers,
    )
    assert len(response.json()) == 1
    assert response.json()[0]["date"] == "2026-02-01"


def test_update_and_delete_transaction(client, auth_headers):
    project_id = _create_project(client, auth_headers)
    create = client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "10.00", "date": "2026-01-01"},
        headers=auth_headers,
    )
    tx_id = create.json()["id"]

    response = client.patch(
        f"/projects/{project_id}/transactions/{tx_id}",
        json={"amount": "-5.00"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["amount"] == "-5.00"

    response = client.delete(f"/projects/{project_id}/transactions/{tx_id}", headers=auth_headers)
    assert response.status_code == 204


def test_suggest_categories_empty_when_no_transactions(client, auth_headers):
    project_id = _create_project(client, auth_headers)
    response = client.get(f"/projects/{project_id}/categories/suggest", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_suggest_categories_returns_distinct_used_categories(client, auth_headers):
    project_id = _create_project(client, auth_headers)
    client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "10.00", "date": "2026-01-01", "category": "cibo"},
        headers=auth_headers,
    )
    client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "20.00", "date": "2026-01-02", "category": "cibo"},
        headers=auth_headers,
    )
    client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "30.00", "date": "2026-01-03", "category": "affitto"},
        headers=auth_headers,
    )

    response = client.get(f"/projects/{project_id}/categories/suggest", headers=auth_headers)
    assert response.status_code == 200
    assert sorted(response.json()) == ["affitto", "cibo"]


def test_transactions_not_accessible_for_other_users_project(client, db_session, auth_headers):
    other_user = User(username="other", password_hash=hash_password("pass"))
    db_session.add(other_user)
    db_session.commit()
    other_project = Project(owner_id=other_user.id, name="Non tuo")
    db_session.add(other_project)
    db_session.commit()

    response = client.get(f"/projects/{other_project.id}/transactions", headers=auth_headers)
    assert response.status_code == 404

    response = client.post(
        f"/projects/{other_project.id}/transactions",
        json={"amount": "1.00", "date": "2026-01-01"},
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_transaction_patch_and_delete_not_accessible_for_other_users_project(
    client, db_session, auth_headers
):
    other_user = User(username="other2", password_hash=hash_password("pass"))
    db_session.add(other_user)
    db_session.commit()
    other_project = Project(owner_id=other_user.id, name="Non tuo")
    db_session.add(other_project)
    db_session.commit()
    from datetime import date as date_type
    from decimal import Decimal

    from app.models.transaction import Transaction

    other_tx = Transaction(project_id=other_project.id, amount=Decimal("5.00"), date=date_type(2026, 1, 1))
    db_session.add(other_tx)
    db_session.commit()

    response = client.patch(
        f"/projects/{other_project.id}/transactions/{other_tx.id}",
        json={"amount": "1.00"},
        headers=auth_headers,
    )
    assert response.status_code == 404

    response = client.delete(
        f"/projects/{other_project.id}/transactions/{other_tx.id}", headers=auth_headers
    )
    assert response.status_code == 404

    response = client.get(f"/projects/{other_project.id}/summary", headers=auth_headers)
    assert response.status_code == 404

    response = client.get(f"/projects/{other_project.id}/categories/suggest", headers=auth_headers)
    assert response.status_code == 404


def test_amount_out_of_bounds_rejected(client, auth_headers):
    project_id = _create_project(client, auth_headers)

    response = client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "1e30", "date": "2026-01-01"},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_patch_transaction_rejects_explicit_null_amount(client, auth_headers):
    project_id = _create_project(client, auth_headers)
    create = client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "10.00", "date": "2026-01-01"},
        headers=auth_headers,
    )
    tx_id = create.json()["id"]

    response = client.patch(
        f"/projects/{project_id}/transactions/{tx_id}",
        json={"amount": None},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_patch_transaction_rejects_explicit_null_date(client, auth_headers):
    project_id = _create_project(client, auth_headers)
    create = client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "10.00", "date": "2026-01-01"},
        headers=auth_headers,
    )
    tx_id = create.json()["id"]

    response = client.patch(
        f"/projects/{project_id}/transactions/{tx_id}",
        json={"date": None},
        headers=auth_headers,
    )
    assert response.status_code == 422
