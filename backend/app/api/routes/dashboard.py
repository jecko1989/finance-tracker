from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.dashboard import RecentTransactionRead
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/recent", response_model=list[RecentTransactionRead])
def get_recent(
    limit: int = Query(default=10, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[RecentTransactionRead]:
    return dashboard_service.get_recent_transactions(db, current_user.id, limit)
