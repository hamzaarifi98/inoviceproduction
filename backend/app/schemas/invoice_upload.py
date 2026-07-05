from typing import Any
from pydantic import BaseModel, Field


class CreateUploadUrlRequest(BaseModel):
    original_filename: str = Field(..., examples=["invoice.pdf"])


class CreateUploadUrlResponse(BaseModel):
    invoice_file_id: str
    s3_key: str
    content_type: str
    upload_url: str
    fields: dict[str, Any]
    max_size_bytes: int
    expires_in_seconds: int


class CompleteUploadRequest(BaseModel):
    invoice_file_id: str
    s3_key: str


class CompleteUploadResponse(BaseModel):
    message: str
    invoice_file_id: str
    s3_key: str
    status: str


class InvoiceFileStatusResponse(BaseModel):
    invoice_file_id: str
    original_filename: str
    s3_key: str
    content_type: str
    size_bytes: int | None
    status: str
    error_message: str | None


class InvoiceUsageResponse(BaseModel):
    used_scans: int
    free_scan_limit: int
    remaining_free_scans: int
    is_pro: bool


class InvoiceProcessingLogResponse(BaseModel):
    id: int
    invoice_file_id: str
    stage: str
    status: str
    message: str | None = None
    duration_ms: int | None = None
    metadata: dict[str, Any] | None = None
    created_at: str
