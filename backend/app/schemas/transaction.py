from datetime import date as date_
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# Bounds match the `Numeric(12, 2)` column: 10 digits before the point.
AMOUNT_MIN = Decimal("-1e10")
AMOUNT_MAX = Decimal("1e10")


class TransactionCreate(BaseModel):
    amount: Decimal = Field(gt=AMOUNT_MIN, lt=AMOUNT_MAX)
    date: date_
    note: str | None = Field(default=None, max_length=500)
    category: str | None = Field(default=None, max_length=80)

    @field_validator("amount")
    @classmethod
    def quantize_amount(cls, value: Decimal) -> Decimal:
        return _quantize(value)


class TransactionUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=AMOUNT_MIN, lt=AMOUNT_MAX)
    date: date_ | None = None
    note: str | None = Field(default=None, max_length=500)
    category: str | None = Field(default=None, max_length=80)

    @field_validator("amount")
    @classmethod
    def quantize_amount(cls, value: Decimal | None) -> Decimal:
        if value is None:
            raise ValueError("amount non può essere nullo")
        return _quantize(value)

    @field_validator("date")
    @classmethod
    def reject_null_date(cls, value: date_ | None) -> date_:
        if value is None:
            raise ValueError("date non può essere nullo")
        return value


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    amount: Decimal
    date: date_
    note: str | None
    category: str | None
    created_at: datetime
