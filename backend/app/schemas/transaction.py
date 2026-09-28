from datetime import date as date_
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class TransactionCreate(BaseModel):
    amount: Decimal
    date: date_
    note: str | None = Field(default=None, max_length=500)
    category: str | None = Field(default=None, max_length=80)

    @field_validator("amount")
    @classmethod
    def quantize_amount(cls, value: Decimal) -> Decimal:
        return _quantize(value)


class TransactionUpdate(BaseModel):
    amount: Decimal | None = None
    date: date_ | None = None
    note: str | None = Field(default=None, max_length=500)
    category: str | None = Field(default=None, max_length=80)

    @field_validator("amount")
    @classmethod
    def quantize_amount(cls, value: Decimal | None) -> Decimal | None:
        return None if value is None else _quantize(value)


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    amount: Decimal
    date: date_
    note: str | None
    category: str | None
    created_at: datetime
