from datetime import date
from decimal import Decimal

from app.models.transaction import Transaction
from app.services.summary_service import get_project_summary


def test_summary_computes_cumulative_and_monthly_flow(db_session):
    from app.models.project import Project
    from app.models.user import User

    user = User(username="u", password_hash="x")
    db_session.add(user)
    db_session.commit()
    project = Project(owner_id=user.id, name="p")
    db_session.add(project)
    db_session.commit()

    db_session.add_all(
        [
            Transaction(project_id=project.id, amount=Decimal("100.00"), date=date(2026, 1, 5)),
            Transaction(project_id=project.id, amount=Decimal("-30.00"), date=date(2026, 1, 10)),
            Transaction(project_id=project.id, amount=Decimal("50.00"), date=date(2026, 2, 1)),
        ]
    )
    db_session.commit()

    summary = get_project_summary(db_session, project.id)

    assert summary.balance == Decimal("120.00")
    assert [p.balance for p in summary.cumulative] == [
        Decimal("100.00"),
        Decimal("70.00"),
        Decimal("120.00"),
    ]
    assert len(summary.flow) == 2
    jan = next(f for f in summary.flow if f.period == "2026-01")
    assert jan.income == Decimal("100.00")
    assert jan.expense == Decimal("30.00")


def test_summary_empty_project_has_zero_balance_and_no_points(db_session):
    from app.models.project import Project
    from app.models.user import User

    user = User(username="u2", password_hash="x")
    db_session.add(user)
    db_session.commit()
    project = Project(owner_id=user.id, name="empty")
    db_session.add(project)
    db_session.commit()

    summary = get_project_summary(db_session, project.id)

    assert summary.balance == Decimal("0")
    assert summary.cumulative == []
    assert summary.flow == []


def test_summary_endpoint(client, auth_headers):
    create = client.post("/projects", json={"name": "p"}, headers=auth_headers)
    project_id = create.json()["id"]
    client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "10.00", "date": "2026-01-01"},
        headers=auth_headers,
    )

    response = client.get(f"/projects/{project_id}/summary", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["balance"] == "10.00"
    assert len(body["cumulative"]) == 1
