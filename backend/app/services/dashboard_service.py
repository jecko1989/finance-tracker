from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.transaction import Transaction
from app.schemas.dashboard import RecentTransactionRead


def get_recent_transactions(db: Session, owner_id: int, limit: int = 10) -> list[RecentTransactionRead]:
    rows = (
        db.query(Transaction, Project.name)
        .join(Project, Transaction.project_id == Project.id)
        .filter(Project.owner_id == owner_id)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(limit)
        .all()
    )
    return [
        RecentTransactionRead(
            id=tx.id,
            project_id=tx.project_id,
            project_name=name,
            amount=tx.amount,
            date=tx.date,
            note=tx.note,
            category=tx.category,
        )
        for tx, name in rows
    ]
