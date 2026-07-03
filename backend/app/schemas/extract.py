from pydantic import BaseModel, Field
from decimal import Decimal
from typing import Optional, List
from datetime import date, time

class ExtractedItem(BaseModel):
    product_name: str
    quantity: Decimal = Field(default=Decimal("1"))
    unit_price: Optional[Decimal] = None
    line_total: Decimal
    category: Optional[str] = None



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