from pydantic import BaseModel


class InvoiceItemResult(BaseModel):
    item_name: str
    quantity: str | None = None
    unit_price: str | None = None
    total_price: str | None = None
    category: str | None = None


class InvoiceResult(BaseModel):
    id: str
    invoice_file_id: str
    supplier_name: str | None = None
    invoice_number: str | None = None
    invoice_date: str | None = None
    currency: str | None = None
    subtotal: str | None = None
    tax_amount: str | None = None
    total_amount: str | None = None
    items: list[InvoiceItemResult]


class InvoiceFileResultResponse(BaseModel):
    invoice_file_id: str
    status: str
    invoice: InvoiceResult | None = None
    error_message: str | None = None


class InvoiceHistoryRecordResponse(BaseModel):
    invoice_file_id: str
    original_filename: str
    status: str
    error_message: str | None = None
    createdAt: str
    updatedAt: str | None = None
    invoice: InvoiceResult | None = None
