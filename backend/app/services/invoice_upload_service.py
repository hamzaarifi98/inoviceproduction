import logging
import time
from uuid import UUID, uuid4

from fastapi import BackgroundTasks, HTTPException, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
from app.crud.invoices import get_invoice_by_file_id

from app.crud.invoice_files import (
    count_invoice_files_for_user,
    create_invoice_file,
    get_invoice_file,
    get_invoice_file_for_user,
    list_invoice_files_for_user,
    mark_invoice_uploaded,
)
from app.crud.invoice_processing_logs import list_invoice_processing_logs_for_user
from app.models.invoice import Invoice
from app.models.users import User
from app.services.invoice_file_rules import (
    get_invoice_content_type,
    build_invoice_s3_key,
    validate_invoice_s3_key,
    validate_invoice_file_signature,
    validate_uploaded_s3_metadata,
)
from app.services.s3_service import (
    create_presigned_post,
    get_s3_object_metadata,
    get_s3_object_prefix_bytes,
    get_max_file_size_bytes,
    upload_s3_object_bytes,
)
from app.services.invoice_processor import process_invoice_from_s3
from app.services.pipeline_logger import log_pipeline_event


logger = logging.getLogger(__name__)
FREE_SCAN_LIMIT = 5


def create_invoice_upload(
    db: Session,
    user: User,
    original_filename: str,
) -> dict:
    """
    Creates a DB record with status='waiting_upload'
    and returns a presigned S3 POST URL.
    """

    try:
        _enforce_scan_access(db=db, user=user)
        invoice_file_id = uuid4()

        content_type = get_invoice_content_type(
            original_filename=original_filename,
        )

        s3_key = build_invoice_s3_key(
            invoice_file_id=invoice_file_id,
            original_filename=original_filename,
        )

        presigned_data = create_presigned_post(
            s3_key=s3_key,
            content_type=content_type,
        )

        invoice_file = create_invoice_file(
            db=db,
            invoice_file_id=invoice_file_id,
            user_id=user.id,
            original_filename=original_filename,
            s3_key=s3_key,
            content_type=content_type,
        )
        log_pipeline_event(
            db=db,
            invoice_file_id=invoice_file.id,
            stage="upload_url.created",
            status="success",
            message="Presigned upload URL created",
            metadata={
                "original_filename": original_filename,
                "content_type": content_type,
                "s3_key": s3_key,
                "max_size_bytes": presigned_data["max_size_bytes"],
                "expires_in_seconds": presigned_data["expires_in_seconds"],
            },
        )

        db.commit()

        return {
            "invoice_file_id": str(invoice_file_id),
            "s3_key": s3_key,
            "content_type": content_type,
            "upload_url": presigned_data["upload_url"],
            "fields": presigned_data["fields"],
            "max_size_bytes": presigned_data["max_size_bytes"],
            "expires_in_seconds": presigned_data["expires_in_seconds"],
        }

    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Invoice upload record already exists",
        )

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        logger.exception("Could not create invoice upload")
        raise HTTPException(
            status_code=500,
            detail="Could not create invoice upload",
        )


async def upload_invoice_file(
    db: Session,
    background_tasks: BackgroundTasks,
    user: User,
    file: UploadFile,
) -> dict:
    """
    Receives an invoice file through the API, stores it in S3,
    marks it uploaded, and queues background invoice processing.
    """

    original_filename = file.filename or ""
    upload_start = time.perf_counter()

    try:
        _enforce_scan_access(db=db, user=user)
        invoice_file_id = uuid4()

        content_type = get_invoice_content_type(
            original_filename=original_filename,
        )

        phase_start = time.perf_counter()
        content = await file.read()
        logger.info(
            "Read uploaded invoice request body in %.2fs: filename=%s size=%s bytes",
            time.perf_counter() - phase_start,
            original_filename,
            len(content),
        )

        phase_start = time.perf_counter()
        validate_uploaded_s3_metadata(
            content_length=len(content),
            content_type=content_type,
            expected_content_type=content_type,
            max_size_bytes=get_max_file_size_bytes(),
        )
        validate_invoice_file_signature(
            content=content,
            content_type=content_type,
        )
        logger.info(
            "Validated uploaded invoice in %.2fs: filename=%s",
            time.perf_counter() - phase_start,
            original_filename,
        )

        s3_key = build_invoice_s3_key(
            invoice_file_id=invoice_file_id,
            original_filename=original_filename,
        )

        invoice_file = create_invoice_file(
            db=db,
            invoice_file_id=invoice_file_id,
            user_id=user.id,
            original_filename=original_filename,
            s3_key=s3_key,
            content_type=content_type,
        )
        log_pipeline_event(
            db=db,
            invoice_file_id=invoice_file.id,
            stage="upload.direct_received",
            status="success",
            message="Invoice file received by API",
            metadata={
                "original_filename": original_filename,
                "content_type": content_type,
                "size_bytes": len(content),
            },
        )

        phase_start = time.perf_counter()
        upload_s3_object_bytes(
            s3_key=s3_key,
            content=content,
            content_type=content_type,
        )
        logger.info(
            "Uploaded invoice to S3 in %.2fs: s3_key=%s size=%s bytes",
            time.perf_counter() - phase_start,
            s3_key,
            len(content),
        )
        log_pipeline_event(
            db=db,
            invoice_file_id=invoice_file.id,
            stage="storage.uploaded",
            status="success",
            message="Invoice uploaded to S3",
            duration_ms=_elapsed_ms(phase_start),
            metadata={
                "s3_key": s3_key,
                "size_bytes": len(content),
                "content_type": content_type,
            },
        )

        mark_invoice_uploaded(
            invoice_file=invoice_file,
            size_bytes=len(content),
            content_type=content_type,
        )
        log_pipeline_event(
            db=db,
            invoice_file_id=invoice_file.id,
            stage="processing.queued",
            status="success",
            message="Invoice processing queued",
        )

        db.commit()
        logger.info(
            "Invoice upload API completed in %.2fs: invoice_file_id=%s",
            time.perf_counter() - upload_start,
            invoice_file_id,
        )

    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Invoice upload record already exists",
        )

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        logger.exception("Could not upload invoice file")
        raise HTTPException(
            status_code=500,
            detail="Could not upload invoice file",
        )

    background_tasks.add_task(
        process_invoice_from_s3,
        invoice_file_id=str(invoice_file.id),
        s3_key=invoice_file.s3_key,
    )

    return {
        "message": "File uploaded. Invoice processing queued.",
        "invoice_file_id": str(invoice_file.id),
        "s3_key": invoice_file.s3_key,
        "status": "processing_queued",
    }


def complete_invoice_upload(
    db: Session,
    background_tasks: BackgroundTasks,
    user_id: int,
    invoice_file_id: str,
    s3_key: str,
) -> dict:
    """
    Called after frontend/mobile uploads directly to S3.

    It:
    1. Checks DB record exists
    2. Checks S3 key matches DB record
    3. Checks object exists in S3
    4. Validates size/content type
    5. Marks DB record as uploaded
    6. Queues background invoice processing
    """

    invoice_uuid = _parse_invoice_uuid(invoice_file_id)

    invoice_file = get_invoice_file_for_user(
        db=db,
        invoice_file_id=invoice_uuid,
        user_id=user_id,
    )

    if invoice_file is None:
        raise HTTPException(
            status_code=404,
            detail="Invoice file record not found",
        )

    if invoice_file.s3_key != s3_key:
        raise HTTPException(
            status_code=400,
            detail="S3 key does not match this invoice file",
        )

    complete_start = time.perf_counter()

    try:
        log_pipeline_event(
            db=db,
            invoice_file_id=invoice_file.id,
            stage="upload.complete_requested",
            status="started",
            message="Mobile client reported direct S3 upload complete",
            metadata={"s3_key": s3_key},
            commit=True,
        )
        validate_invoice_s3_key(s3_key)

        metadata = get_s3_object_metadata(s3_key=s3_key)

        if metadata is None:
            raise ValueError("File was not uploaded to S3")

        content_length = metadata["content_length"]
        content_type = metadata["content_type"]

        validate_uploaded_s3_metadata(
            content_length=content_length,
            content_type=content_type,
            expected_content_type=invoice_file.content_type,
            max_size_bytes=get_max_file_size_bytes(),
        )
        validate_invoice_file_signature(
            content=get_s3_object_prefix_bytes(s3_key=s3_key),
            content_type=content_type,
        )
        log_pipeline_event(
            db=db,
            invoice_file_id=invoice_file.id,
            stage="storage.validated",
            status="success",
            message="S3 object metadata and file signature validated",
            duration_ms=_elapsed_ms(complete_start),
            metadata={
                "size_bytes": content_length,
                "content_type": content_type,
            },
        )

        mark_invoice_uploaded(
            invoice_file=invoice_file,
            size_bytes=content_length,
            content_type=content_type,
        )
        log_pipeline_event(
            db=db,
            invoice_file_id=invoice_file.id,
            stage="processing.queued",
            status="success",
            message="Invoice processing queued",
        )

        db.commit()

    except ValueError as e:
        db.rollback()
        _try_log_pipeline_failure(
            db=db,
            invoice_file_id=invoice_file.id,
            stage="upload.complete_failed",
            message=str(e),
        )
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as exc:
        db.rollback()
        _try_log_pipeline_failure(
            db=db,
            invoice_file_id=invoice_file.id,
            stage="upload.complete_failed",
            message=str(exc),
        )
        raise HTTPException(
            status_code=500,
            detail="Could not complete invoice upload",
        )

    background_tasks.add_task(
        process_invoice_from_s3,
        invoice_file_id=str(invoice_file.id),
        s3_key=invoice_file.s3_key,
    )

    return {
        "message": "Upload completed. Invoice processing queued.",
        "invoice_file_id": str(invoice_file.id),
        "s3_key": invoice_file.s3_key,
        "status": "processing_queued",
    }


def get_invoice_upload_status(
    db: Session,
    user_id: int,
    invoice_file_id: str,
) -> dict:
    invoice_uuid = _parse_invoice_uuid(invoice_file_id)

    invoice_file = get_invoice_file_for_user(
        db=db,
        invoice_file_id=invoice_uuid,
        user_id=user_id,
    )

    if invoice_file is None:
        raise HTTPException(
            status_code=404,
            detail="Invoice file not found",
        )

    return {
        "invoice_file_id": str(invoice_file.id),
        "original_filename": invoice_file.original_filename,
        "s3_key": invoice_file.s3_key,
        "content_type": invoice_file.content_type,
        "size_bytes": invoice_file.size_bytes,
        "status": invoice_file.status,
        "error_message": invoice_file.error_message,
    }


def retry_invoice_processing(
    db: Session,
    background_tasks: BackgroundTasks,
    user_id: int,
    invoice_file_id: str,
) -> dict:
    invoice_uuid = _parse_invoice_uuid(invoice_file_id)

    invoice_file = get_invoice_file_for_user(
        db=db,
        invoice_file_id=invoice_uuid,
        user_id=user_id,
    )

    if invoice_file is None:
        raise HTTPException(
            status_code=404,
            detail="Invoice file not found",
        )

    if invoice_file.status == "waiting_upload":
        raise HTTPException(
            status_code=400,
            detail="Invoice file was not uploaded yet",
        )

    invoice_file.status = "uploaded"
    invoice_file.error_message = None
    invoice_file.processed_at = None
    log_pipeline_event(
        db=db,
        invoice_file_id=invoice_file.id,
        stage="processing.retry_queued",
        status="success",
        message="Invoice processing retry queued",
    )
    db.commit()

    background_tasks.add_task(
        process_invoice_from_s3,
        invoice_file_id=str(invoice_file.id),
        s3_key=invoice_file.s3_key,
    )

    return {
        "message": "Invoice processing retried.",
        "invoice_file_id": str(invoice_file.id),
        "s3_key": invoice_file.s3_key,
        "status": "processing_queued",
    }


def _parse_invoice_uuid(invoice_file_id: str) -> UUID:
    try:
        return UUID(invoice_file_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid invoice_file_id",
        )


def _enforce_scan_access(
    db: Session,
    user: User,
) -> None:
    if user.is_pro:
        return

    scan_count = count_invoice_files_for_user(db=db, user_id=user.id)
    if scan_count >= FREE_SCAN_LIMIT:
        raise HTTPException(
            status_code=403,
            detail="Free scan limit reached. Register, subscribe to Pro, and log in to continue.",
        )


def get_invoice_usage(
    db: Session,
    user: User,
) -> dict:
    used_scans = count_invoice_files_for_user(db=db, user_id=user.id)
    return {
        "used_scans": used_scans,
        "free_scan_limit": FREE_SCAN_LIMIT,
        "remaining_free_scans": max(FREE_SCAN_LIMIT - used_scans, 0),
        "is_pro": user.is_pro,
    }
    

def get_invoice_history(
    db: Session,
    user_id: int,
) -> list[dict]:
    invoice_files = list_invoice_files_for_user(db=db, user_id=user_id)

    if not invoice_files:
        return []

    invoice_file_ids = [invoice_file.id for invoice_file in invoice_files]
    invoices = (
        db.query(Invoice)
        .options(selectinload(Invoice.items))
        .filter(
            Invoice.user_id == user_id,
            Invoice.invoice_file_id.in_(invoice_file_ids),
        )
        .all()
    )
    invoices_by_file_id = {invoice.invoice_file_id: invoice for invoice in invoices}

    return [
        _invoice_file_history_payload(
            invoice_file=invoice_file,
            invoice=invoices_by_file_id.get(invoice_file.id),
        )
        for invoice_file in invoice_files
    ]


def get_invoice_result(
    db: Session,
    user_id: int,
    invoice_file_id: str,
) -> dict:
    invoice_uuid = _parse_invoice_uuid(invoice_file_id)

    invoice_file = get_invoice_file_for_user(
        db=db,
        invoice_file_id=invoice_uuid,
        user_id=user_id,
    )

    if invoice_file is None:
        raise HTTPException(
            status_code=404,
            detail="Invoice file not found",
        )

    if invoice_file.status == "failed":
        return {
            "invoice_file_id": str(invoice_file.id),
            "status": invoice_file.status,
            "invoice": None,
            "error_message": invoice_file.error_message,
        }

    if invoice_file.status != "processed":
        return {
            "invoice_file_id": str(invoice_file.id),
            "status": invoice_file.status,
            "invoice": None,
            "error_message": None,
        }

    invoice = get_invoice_by_file_id(
        db=db,
        invoice_file_id=invoice_uuid,
        user_id=user_id,
    )

    if invoice is None:
        raise HTTPException(
            status_code=404,
            detail="Processed invoice data not found",
        )

    return {
        "invoice_file_id": str(invoice_file.id),
        "status": invoice_file.status,
        "error_message": None,
        "invoice": _invoice_payload(invoice),
    }


def get_invoice_processing_logs(
    db: Session,
    user_id: int,
    invoice_file_id: str,
) -> list[dict]:
    invoice_uuid = _parse_invoice_uuid(invoice_file_id)
    logs = list_invoice_processing_logs_for_user(
        db=db,
        invoice_file_id=invoice_uuid,
        user_id=user_id,
    )
    return [_pipeline_log_payload(log) for log in logs]


def _invoice_file_history_payload(
    invoice_file,
    invoice: Invoice | None,
) -> dict:
    updated_at = (
        invoice_file.processed_at
        or invoice_file.uploaded_at
        or invoice_file.processing_started_at
        or invoice_file.created_at
    )

    return {
        "invoice_file_id": str(invoice_file.id),
        "original_filename": invoice_file.original_filename,
        "status": invoice_file.status,
        "error_message": invoice_file.error_message,
        "createdAt": invoice_file.created_at.isoformat(),
        "updatedAt": updated_at.isoformat() if updated_at else None,
        "invoice": _invoice_payload(invoice) if invoice else None,
    }


def _invoice_payload(invoice: Invoice) -> dict:
    return {
        "id": str(invoice.id),
        "invoice_file_id": str(invoice.invoice_file_id),
        "supplier_name": invoice.supplier_name,
        "invoice_number": invoice.invoice_number,
        "invoice_date": invoice.invoice_date.isoformat() if invoice.invoice_date else None,
        "currency": invoice.currency,
        "subtotal": str(invoice.subtotal) if invoice.subtotal is not None else None,
        "tax_amount": str(invoice.tax_amount) if invoice.tax_amount is not None else None,
        "total_amount": str(invoice.total_amount) if invoice.total_amount is not None else None,
        "items": [
            {
                "item_name": item.item_name,
                "quantity": str(item.quantity) if item.quantity is not None else None,
                "unit_price": str(item.unit_price) if item.unit_price is not None else None,
                "total_price": str(item.total_price) if item.total_price is not None else None,
                "category": item.category,
            }
            for item in invoice.items
        ],
    }


def _pipeline_log_payload(log) -> dict:
    return {
        "id": log.id,
        "invoice_file_id": str(log.invoice_file_id),
        "stage": log.stage,
        "status": log.status,
        "message": log.message,
        "duration_ms": log.duration_ms,
        "metadata": log.metadata_json,
        "created_at": log.created_at.isoformat(),
    }


def _elapsed_ms(started_at: float) -> int:
    return int((time.perf_counter() - started_at) * 1000)


def _try_log_pipeline_failure(
    db: Session,
    invoice_file_id: UUID,
    stage: str,
    message: str,
) -> None:
    try:
        log_pipeline_event(
            db=db,
            invoice_file_id=invoice_file_id,
            stage=stage,
            status="failed",
            message=message,
            commit=True,
        )
    except Exception:
        db.rollback()
        logger.exception("Could not persist pipeline failure log for %s", invoice_file_id)
