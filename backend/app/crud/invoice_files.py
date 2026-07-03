# app/crud/invoice_files.py

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.invoice_file import InvoiceFile, InvoiceFileStatus


def create_invoice_file(
    db: Session,
    invoice_file_id: UUID,
    user_id: int,
    original_filename: str,
    s3_key: str,
    content_type: str,
) -> InvoiceFile:
    invoice_file = InvoiceFile(
        id=invoice_file_id,
        user_id=user_id,
        original_filename=original_filename,
        s3_key=s3_key,
        content_type=content_type,
        status=InvoiceFileStatus.WAITING_UPLOAD.value,
    )

    db.add(invoice_file)
    return invoice_file


def get_invoice_file(
    db: Session,
    invoice_file_id: UUID,
) -> InvoiceFile | None:
    return (
        db.query(InvoiceFile)
        .filter(InvoiceFile.id == invoice_file_id)
        .first()
    )


def get_invoice_file_for_user(
    db: Session,
    invoice_file_id: UUID,
    user_id: int,
) -> InvoiceFile | None:
    return (
        db.query(InvoiceFile)
        .filter(
            InvoiceFile.id == invoice_file_id,
            InvoiceFile.user_id == user_id,
        )
        .first()
    )


def count_invoice_files_for_user(
    db: Session,
    user_id: int,
) -> int:
    return db.query(InvoiceFile).filter(InvoiceFile.user_id == user_id).count()


def mark_invoice_uploaded(
    invoice_file: InvoiceFile,
    size_bytes: int,
    content_type: str,
) -> InvoiceFile:
    invoice_file.status = InvoiceFileStatus.UPLOADED.value
    invoice_file.size_bytes = size_bytes
    invoice_file.content_type = content_type
    invoice_file.uploaded_at = InvoiceFile.utc_now()
    invoice_file.error_message = None

    return invoice_file


def mark_invoice_processing(
    invoice_file: InvoiceFile,
) -> InvoiceFile:
    invoice_file.status = InvoiceFileStatus.PROCESSING.value
    invoice_file.processing_started_at = InvoiceFile.utc_now()
    invoice_file.error_message = None

    return invoice_file


def mark_invoice_processed(
    invoice_file: InvoiceFile,
) -> InvoiceFile:
    invoice_file.status = InvoiceFileStatus.PROCESSED.value
    invoice_file.processed_at = InvoiceFile.utc_now()
    invoice_file.error_message = None

    return invoice_file


def mark_invoice_failed(
    invoice_file: InvoiceFile,
    error_message: str,
) -> InvoiceFile:
    invoice_file.status = InvoiceFileStatus.FAILED.value
    invoice_file.error_message = error_message
    invoice_file.processed_at = InvoiceFile.utc_now()

    return invoice_file
