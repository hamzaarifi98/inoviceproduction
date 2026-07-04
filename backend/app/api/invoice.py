from pathlib import Path
from tempfile import NamedTemporaryFile
import os

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from app.models.invoice import Invoice
from app.models.invoice_file import InvoiceFile
from app.models.invoice_item import InvoiceItem

from app.core.security import get_current_user
from app.models.users import User
from app.schemas.invoice_result import InvoiceFileResultResponse, InvoiceHistoryRecordResponse
from app.core.database import get_db
from app.schemas.invoice_upload import (
    CreateUploadUrlRequest,
    CreateUploadUrlResponse,
    CompleteUploadRequest,
    CompleteUploadResponse,
    InvoiceFileStatusResponse,
    InvoiceUsageResponse,
)
from app.services.invoice_upload_service import (
    create_invoice_upload,
    complete_invoice_upload,
    upload_invoice_file,
    get_invoice_upload_status,
    get_invoice_result,
    get_invoice_history,
    get_invoice_usage,
    retry_invoice_processing,
)
from app.services.invoice_file_rules import get_invoice_content_type
from app.services.invoice_processor import build_invoice_payload


router = APIRouter(
    prefix="/invoices",
    tags=["Invoices"],
)


@router.post(
    "/upload",
    response_model=CompleteUploadResponse,
)
async def upload_invoice(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await upload_invoice_file(
        db=db,
        background_tasks=background_tasks,
        user=current_user,
        file=file,
    )


@router.post("/debug/extract")
async def debug_extract_invoice(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Test the extraction pipeline without S3, background tasks, or DB writes.

    Upload a JPG/PNG/PDF here from FastAPI docs to run:
    file -> Google Vision OCR -> LLM extraction -> invoice payload.
    """

    if not _is_enabled("ENABLE_DEBUG_ENDPOINTS"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )
    _require_admin(current_user)

    original_filename = file.filename or ""
    temp_file_path: str | None = None

    try:
        content_type = get_invoice_content_type(original_filename)
        extension = Path(original_filename).suffix.lower()
        content = await file.read()

        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        with NamedTemporaryFile(delete=False, suffix=extension) as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name

        from app.services.google_ocr import GoogleOCRService
        from app.services.llm_extraction import LLMExtractionService

        ocr_service = GoogleOCRService()
        llm_service = LLMExtractionService()

        raw_ocr_text = ocr_service.extract_text(temp_file_path)
        extracted_invoice = llm_service.extract_invoice_data(raw_ocr_text)
        extracted_json = build_invoice_payload(extracted_invoice)

        return {
            "message": "Extraction test completed",
            "filename": original_filename,
            "content_type": content_type,
            "extracted": extracted_json,
        }

    except HTTPException:
        raise

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except Exception:
        raise HTTPException(status_code=500, detail="Extraction test failed")

    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@router.post(
    "/upload-url",
    response_model=CreateUploadUrlResponse,
)
def create_upload_url(
    request: CreateUploadUrlRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_invoice_upload(
        db=db,
        user=current_user,
        original_filename=request.original_filename,
    )


@router.post(
    "/complete-upload",
    response_model=CompleteUploadResponse,
)
def complete_upload(
    request: CompleteUploadRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return complete_invoice_upload(
        db=db,
        background_tasks=background_tasks,
        user_id=current_user.id,
        invoice_file_id=request.invoice_file_id,
        s3_key=request.s3_key,
    )


@router.get(
    "/usage",
    response_model=InvoiceUsageResponse,
)
def get_upload_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_invoice_usage(
        db=db,
        user=current_user,
    )


@router.get(
    "/history",
    response_model=list[InvoiceHistoryRecordResponse],
)
def get_upload_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_invoice_history(
        db=db,
        user_id=current_user.id,
    )


@router.get(
    "/files/{invoice_file_id}/status",
    response_model=InvoiceFileStatusResponse,
)
def get_upload_status(
    invoice_file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_invoice_upload_status(
        db=db,
        user_id=current_user.id,
        invoice_file_id=invoice_file_id,
    )

@router.get(
    "/files/{invoice_file_id}/result",
    response_model=InvoiceFileResultResponse,
)
def get_upload_result(
    invoice_file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_invoice_result(
        db=db,
        user_id=current_user.id,
        invoice_file_id=invoice_file_id,
    )


@router.post(
    "/files/{invoice_file_id}/retry",
    response_model=CompleteUploadResponse,
)
def retry_upload_processing(
    invoice_file_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return retry_invoice_processing(
        db=db,
        background_tasks=background_tasks,
        user_id=current_user.id,
        invoice_file_id=invoice_file_id,
    )

@router.delete(
    "/admin/all-data",
    status_code=status.HTTP_200_OK,
)
def delete_all_invoice_data_as_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_enabled("ENABLE_ADMIN_DELETE"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )
    _require_admin(current_user)

    deleted_items = db.query(InvoiceItem).delete(synchronize_session=False)
    deleted_invoices = db.query(Invoice).delete(synchronize_session=False)
    deleted_files = db.query(InvoiceFile).delete(synchronize_session=False)

    db.commit()

    return {
        "message": "All invoice data was deleted.",
        "deleted_items": deleted_items,
        "deleted_invoices": deleted_invoices,
        "deleted_invoice_files": deleted_files,
    }


def _require_admin(user: User) -> None:
    admin_email = os.getenv("ADMIN_EMAIL")

    if not admin_email or user.email.lower() != admin_email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )


def _is_enabled(env_name: str) -> bool:
    return os.getenv(env_name, "").lower() in {"1", "true", "yes", "on"}
