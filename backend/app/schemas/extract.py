from decimal import Decimal
from typing import Optional, List
from datetime import date, time

from pydantic import BaseModel, Field, model_validator


class ExtractedItem(BaseModel):
    product_name: str
    quantity: Decimal = Field(default=Decimal("1"))
    unit_price: Optional[Decimal] = None
    line_total: Optional[Decimal] = None
    category: Optional[str] = None

    @model_validator(mode="after")
    def fill_missing_line_total(self):
        if self.line_total is None and self.unit_price is not None and self.quantity is not None:
            self.line_total = self.unit_price * self.quantity

        return self


class ExtractedInvoice(BaseModel):
    store_name: Optional[str] = None
    address: Optional[str] = None
    receipt_date: Optional[date] = None
    receipt_time: Optional[time] = None
    subtotal: Optional[Decimal] = None
    vat_total: Optional[Decimal] = None
    total: Optional[Decimal] = None
    payment_method: Optional[str] = None
    items: List[ExtractedItem] = Field(default_factory=list)