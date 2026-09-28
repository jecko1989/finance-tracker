from datetime import date as date_

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionUpdate


def list_transactions(
    db: Session,
    project_id: int,
    from_date: date_ | None = None,
    to_date: date_ | None = None,
    category: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Transaction]:
    query = db.query(Transaction).filter(Transaction.project_id == project_id)
    if from_date is not None:
        query = query.filter(Transaction.date >= from_date)
    if to_date is not None:
        query = query.filter(Transaction.date <= to_date)
    if category is not None:
        query = query.filter(Transaction.category == category)
    return (
        query.order_by(Transaction.date.desc(), Transaction.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_transaction_or_404(db: Session, project_id: int, tx_id: int) -> Transaction:
    tx = (
        db.query(Transaction)
        .filter(Transaction.id == tx_id, Transaction.project_id == project_id)
        .first()
    )
    if tx is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transazione non trovata")
    return tx


def create_transaction(db: Session, project_id: int, data: TransactionCreate) -> Transaction:
    tx = Transaction(project_id=project_id, **data.model_dump())
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def update_transaction(db: Session, project_id: int, tx_id: int, data: TransactionUpdate) -> Transaction:
    tx = get_transaction_or_404(db, project_id, tx_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(tx, field, value)
    db.commit()
    db.refresh(tx)
    return tx


def delete_transaction(db: Session, project_id: int, tx_id: int) -> None:
    tx = get_transaction_or_404(db, project_id, tx_id)
    db.delete(tx)
    db.commit()


def suggest_categories(db: Session, project_id: int) -> list[str]:
    rows = (
        db.query(Transaction.category)
        .filter(Transaction.project_id == project_id, Transaction.category.isnot(None))
        .distinct()
        .order_by(Transaction.category)
        .all()
    )
    return [row[0] for row in rows]
