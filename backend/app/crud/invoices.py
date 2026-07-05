# app/crud/invoices.py

from datetime import date
from decimal import Decimal
import re
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
    total_amount = _calculate_invoice_total(extracted_json)
    invoice = Invoice(
        invoice_file_id=invoice_file_id,
        user_id=user_id,
        supplier_name=extracted_json.get("supplier_name"),
        invoice_number=extracted_json.get("invoice_number"),
        invoice_date=_parse_date(extracted_json.get("invoice_date")),
        currency=extracted_json.get("currency"),
        subtotal=_parse_decimal(extracted_json.get("subtotal")),
        tax_amount=_parse_decimal(extracted_json.get("tax_amount")),
        total_amount=total_amount,
        raw_ocr_text=raw_ocr_text,
        extracted_json={
            **extracted_json,
            "total_amount": str(total_amount) if total_amount is not None else extracted_json.get("total_amount"),
        },
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

    if isinstance(value, Decimal):
        return value

    normalized = _normalize_decimal_text(str(value))

    if not normalized:
        return None

    try:
        return Decimal(normalized)
    except Exception:
        return None


def _calculate_invoice_total(extracted_json: dict) -> Decimal | None:
    explicit_total = _parse_decimal(extracted_json.get("total_amount"))

    if explicit_total is not None and explicit_total > 0:
        return explicit_total

    items_total = sum(
        (
            _calculate_item_total(item)
            for item in extracted_json.get("items", [])
            if isinstance(item, dict)
        ),
        Decimal("0"),
    )

    return items_total if items_total > 0 else explicit_total


def _calculate_item_total(item: dict) -> Decimal:
    explicit_total = _parse_decimal(item.get("total_price") or item.get("line_total"))

    if explicit_total is not None and explicit_total > 0:
        return explicit_total

    unit_price = _parse_decimal(item.get("unit_price"))
    quantity = _parse_decimal(item.get("quantity")) or Decimal("1")

    if unit_price is not None and unit_price > 0:
        return unit_price * quantity

    return Decimal("0")


def _normalize_decimal_text(value: str) -> str:
    cleaned = re.sub(r"[^0-9,.\-]", "", value.strip())

    if not cleaned or cleaned == "-":
        return ""

    last_comma = cleaned.rfind(",")
    last_dot = cleaned.rfind(".")

    if last_comma != -1 and last_dot != -1:
        decimal_separator = "," if last_comma > last_dot else "."
        thousands_separator = "." if decimal_separator == "," else ","
        return cleaned.replace(thousands_separator, "").replace(decimal_separator, ".")

    if last_comma != -1:
        return _normalize_single_separator(cleaned, ",")

    return cleaned


def _normalize_single_separator(value: str, separator: str) -> str:
    parts = value.split(separator)

    if len(parts) == 1:
        return value

    decimal_part = parts[-1]
    integer_part = "".join(parts[:-1])

    if len(decimal_part) in {1, 2}:
        return f"{integer_part}.{decimal_part}"

    return f"{integer_part}{decimal_part}"


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
