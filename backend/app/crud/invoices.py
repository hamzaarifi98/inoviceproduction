# app/crud/invoices.py

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session, selectinload

from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem


def create_invoice_record(
    db: Session,
    invoice_file_id: UUID,
    user_id: int,
    raw_ocr_text: str,
    extracted_json: dict,
) -> Invoice:
    invoice = Invoice(
        invoice_file_id=invoice_file_id,
        user_id=user_id,
        supplier_name=extracted_json.get("supplier_name"),
        invoice_number=extracted_json.get("invoice_number"),
        invoice_date=_parse_date(extracted_json.get("invoice_date")),
        currency=extracted_json.get("currency"),
        subtotal=_parse_decimal(extracted_json.get("subtotal")),
        tax_amount=_parse_decimal(extracted_json.get("tax_amount")),
        total_amount=_parse_decimal(extracted_json.get("total_amount")),
        raw_ocr_text=raw_ocr_text,
        extracted_json=extracted_json,
    )

    db.add(invoice)
    db.flush()

    return invoice


def create_invoice_items(
    db: Session,
    invoice_id: UUID,
    items: list[dict],
) -> list[InvoiceItem]:
    invoice_items = []

    for item in items:
        item_name = item.get("item_name") or item.get("name")

        if not item_name:
            continue

        invoice_item = InvoiceItem(
            invoice_id=invoice_id,
            item_name=item_name,
            quantity=_parse_decimal(item.get("quantity")),
            unit_price=_parse_decimal(item.get("unit_price")),
            total_price=_parse_decimal(item.get("total_price")),
            category=item.get("category"),
        )

        db.add(invoice_item)
        invoice_items.append(invoice_item)

    db.flush()

    return invoice_items


def save_extracted_invoice(
    db: Session,
    invoice_file_id: UUID,
    user_id: int,
    raw_ocr_text: str,
    extracted_json: dict,
) -> Invoice:
    invoice = create_invoice_record(
        db=db,
        invoice_file_id=invoice_file_id,
        user_id=user_id,
        raw_ocr_text=raw_ocr_text,
        extracted_json=extracted_json,
    )

    items = extracted_json.get("items", [])

    if isinstance(items, list):
        create_invoice_items(
            db=db,
            invoice_id=invoice.id,
            items=items,
        )

    return invoice


def _parse_decimal(value) -> Decimal | None:
    if value is None or value == "":
        return None

    try:
        return Decimal(str(value).replace(",", "."))
    except Exception:
        return None


def _parse_date(value) -> date | None:
    if not value:
        return None

    try:
        return date.fromisoformat(value)
    except Exception:
        return None
    
def get_invoice_by_file_id(
    db: Session,
    invoice_file_id: UUID,
    user_id: int,
) -> Invoice | None:
    return (
        db.query(Invoice)
        .options(selectinload(Invoice.items))
        .filter(
            Invoice.invoice_file_id == invoice_file_id,
            Invoice.user_id == user_id,
        )
        .first()
    )
