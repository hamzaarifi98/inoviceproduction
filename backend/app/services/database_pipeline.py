from app.core.database import SessionLocal
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.schemas.extract import ExtractedInvoice


class DatabasePipeline:
    def save_invoice(self, extracted: ExtractedInvoice) -> int:
        invoice = Invoice(
            **extracted.model_dump(exclude={"items"}),
            items=[
                InvoiceItem(**item.model_dump())
                for item in extracted.items
            ],
        )

        with SessionLocal() as db:
            try:
                db.add(invoice)
                db.commit()
                db.refresh(invoice)
                return invoice.id
            except Exception:
                db.rollback()
                raise
