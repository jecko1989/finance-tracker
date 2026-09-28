from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class RecentTransactionRead(BaseModel):
    id: int
    project_id: int
    project_name: str
    amount: Decimal
    date: date
    note: str | None
    category: str | None
