from pathlib import Path
import re
from uuid import UUID


ALLOWED_INVOICE_FILE_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


def get_invoice_file_extension(original_filename: str) -> str:
    extension = Path(original_filename).suffix.lower()

    if not extension:
        raise ValueError("File extension is missing")

    if extension not in ALLOWED_INVOICE_FILE_TYPES:
        raise ValueError("Only PDF, PNG, JPG, and JPEG files are allowed")

    return extension


def get_invoice_content_type(original_filename: str) -> str:
    extension = get_invoice_file_extension(original_filename)
    return ALLOWED_INVOICE_FILE_TYPES[extension]


def build_invoice_s3_key(
    invoice_file_id: UUID,
    original_filename: str,
) -> str:
    extension = get_invoice_file_extension(original_filename)
    return f"invoices/raw/{invoice_file_id}{extension}"


def validate_invoice_s3_key(s3_key: str) -> None:
    if not re.fullmatch(
        r"invoices/raw/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(pdf|png|jpg|jpeg)",
        s3_key,
    ):
        raise ValueError("Invalid S3 key")

    extension = Path(s3_key).suffix.lower()

    if extension not in ALLOWED_INVOICE_FILE_TYPES:
        raise ValueError("Invalid invoice file extension")


def validate_uploaded_s3_metadata(
    content_length: int | None,
    content_type: str | None,
    expected_content_type: str,
    max_size_bytes: int,
) -> None:
    if content_length is None or content_length <= 0:
        raise ValueError("Uploaded file is empty")

    if content_length > max_size_bytes:
        raise ValueError("Uploaded file is too large")

    if content_type != expected_content_type:
        raise ValueError(
            f"Invalid content type. Expected {expected_content_type}, got {content_type}"
        )


def validate_invoice_file_signature(content: bytes, content_type: str) -> None:
    if content_type == "application/pdf" and not content.startswith(b"%PDF-"):
        raise ValueError("Invalid PDF file")

    if content_type == "image/png" and not content.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("Invalid PNG file")

    if content_type == "image/jpeg" and not content.startswith(b"\xff\xd8\xff"):
        raise ValueError("Invalid JPEG file")
