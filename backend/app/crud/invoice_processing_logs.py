from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.invoice_file import InvoiceFile
from app.models.invoice_processing_log import InvoiceProcessingLog


def create_invoice_processing_log(
    db: Session,
    invoice_file_id: UUID,
    stage: str,
    *,
    status: str = "info",
    message: str | None = None,
    duration_ms: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> InvoiceProcessingLog:
    log = InvoiceProcessingLog(
        invoice_file_id=invoice_file_id,
        stage=stage,
        status=status,
        message=message,
        duration_ms=duration_ms,
        metadata_json=metadata,
    )
    db.add(log)
    db.flush()
    return log


def list_invoice_processing_logs_for_user(
    db: Session,
    invoice_file_id: UUID,
    user_id: int,
) -> list[InvoiceProcessingLog]:
    return (
        db.query(InvoiceProcessingLog)
        .join(InvoiceFile, InvoiceFile.id == InvoiceProcessingLog.invoice_file_id)
        .filter(
            InvoiceProcessingLog.invoice_file_id == invoice_file_id,
            InvoiceFile.user_id == user_id,
        )
        .order_by(InvoiceProcessingLog.created_at.asc(), InvoiceProcessingLog.id.asc())
        .all()
    )
