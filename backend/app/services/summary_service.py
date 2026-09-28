from collections import defaultdict
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.schemas.summary import BalancePoint, FlowPoint, ProjectSummary

# ponytail: aggregation done in Python over the whole row set, not SQL GROUP
# BY. Fine for a personal-finance project's transaction volume; move to a
# SQL aggregate if a single project ever grows into the tens of thousands
# of transactions and this becomes measurably slow.


def get_project_summary(db: Session, project_id: int) -> ProjectSummary:
    transactions = (
        db.query(Transaction)
        .filter(Transaction.project_id == project_id)
        .order_by(Transaction.date, Transaction.id)
        .all()
    )

    cumulative: list[BalancePoint] = []
    running = Decimal("0")
    for tx in transactions:
        running += tx.amount
        cumulative.append(BalancePoint(date=tx.date, balance=running))

    flow_totals: dict[str, dict[str, Decimal]] = defaultdict(
        lambda: {"income": Decimal("0"), "expense": Decimal("0")}
    )
    for tx in transactions:
        period = tx.date.strftime("%Y-%m")
        if tx.amount >= 0:
            flow_totals[period]["income"] += tx.amount
        else:
            flow_totals[period]["expense"] += -tx.amount

    flow = [
        FlowPoint(period=period, income=totals["income"], expense=totals["expense"])
        for period, totals in sorted(flow_totals.items())
    ]

    return ProjectSummary(balance=running, cumulative=cumulative, flow=flow)
