from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class BalancePoint(BaseModel):
    date: date
    balance: Decimal


class FlowPoint(BaseModel):
    period: str
    income: Decimal
    expense: Decimal


class ProjectSummary(BaseModel):
    balance: Decimal
    cumulative: list[BalancePoint]
    flow: list[FlowPoint]
