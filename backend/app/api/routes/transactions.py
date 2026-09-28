from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.transaction import TransactionCreate, TransactionRead, TransactionUpdate
from app.services import project_service, transaction_service

router = APIRouter(prefix="/projects/{project_id}/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    project_id: int,
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    category: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TransactionRead]:
    project_service.get_project_or_404(db, current_user.id, project_id)
    return transaction_service.list_transactions(
        db, project_id, from_date, to_date, category, limit, offset
    )


@router.post("", response_model=TransactionRead, status_code=201)
def create_transaction(
    project_id: int,
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionRead:
    project_service.get_project_or_404(db, current_user.id, project_id)
    return transaction_service.create_transaction(db, project_id, payload)


@router.patch("/{tx_id}", response_model=TransactionRead)
def update_transaction(
    project_id: int,
    tx_id: int,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionRead:
    project_service.get_project_or_404(db, current_user.id, project_id)
    return transaction_service.update_transaction(db, project_id, tx_id, payload)


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(
    project_id: int,
    tx_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    project_service.get_project_or_404(db, current_user.id, project_id)
    transaction_service.delete_transaction(db, project_id, tx_id)
