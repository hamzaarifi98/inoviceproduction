# app/services/invoice_processor.py

import logging
import os
import time
from pathlib import Path
from tempfile import NamedTemporaryFile
from uuid import UUID

from app.core.database import SessionLocal
from app.crud.invoice_files import (
    get_invoice_file,
    mark_invoice_processing,
    mark_invoice_processed,
    mark_invoice_failed,
)
from app.crud.invoices import save_extracted_invoice
from app.services.s3_service import download_s3_object_to_file
from app.services.llm_extraction import LLMExtractionService
from app.services.google_ocr2 import GoogleOCRFastService

ocr_service = GoogleOCRFastService()
llm_service = LLMExtractionService()

logger = logging.getLogger(__name__)


def process_invoice_from_s3(
    invoice_file_id: str,
    s3_key: str,
) -> None:
    db = SessionLocal()
    temp_file_path: str | None = None

    try:
        invoice_uuid = UUID(invoice_file_id)

        invoice_file = get_invoice_file(
            db=db,
            invoice_file_id=invoice_uuid,
        )

        if invoice_file is None:
            return

        mark_invoice_processing(invoice_file)
        db.commit()
        processing_start = time.perf_counter()
        logger.info("Invoice processing started: invoice_file_id=%s", invoice_file_id)

        extension = Path(s3_key).suffix.lower()

        with NamedTemporaryFile(delete=False, suffix=extension) as temp_file:
            temp_file_path = temp_file.name

        phase_start = time.perf_counter()
        logger.info("Downloading invoice from S3: s3_key=%s", s3_key)
        download_s3_object_to_file(
            s3_key=s3_key,
            destination_path=temp_file_path,
        )
        logger.info(
            "Invoice downloaded to temporary file in %.2fs",
            time.perf_counter() - phase_start,
        )

        phase_start = time.perf_counter()
        logger.info("Starting Google OCR text extraction")
        raw_ocr_text = ocr_service.extract_text(temp_file_path)
        logger.info(
            "Google OCR text extraction finished in %.2fs",
            time.perf_counter() - phase_start,
        )

        phase_start = time.perf_counter()
        logger.info("Starting LLM invoice extraction")
        extracted_invoice = llm_service.extract_invoice_data(raw_ocr_text)
        logger.info(
            "LLM invoice extraction finished in %.2fs",
            time.perf_counter() - phase_start,
        )
        extracted_json = build_invoice_payload(extracted_invoice)

        phase_start = time.perf_counter()
        save_extracted_invoice(
            db=db,
            invoice_file_id=invoice_uuid,
            user_id=invoice_file.user_id,
            raw_ocr_text=raw_ocr_text,
            extracted_json=extracted_json,
        )

        mark_invoice_processed(invoice_file)
        db.commit()
        logger.info(
            "Invoice DB save finished in %.2fs",
            time.perf_counter() - phase_start,
        )
        logger.info(
            "Invoice processing completed in %.2fs: invoice_file_id=%s",
            time.perf_counter() - processing_start,
            invoice_file_id,
        )

    except Exception:
        db.rollback()

        try:
            invoice_uuid = UUID(invoice_file_id)

            invoice_file = get_invoice_file(
                db=db,
                invoice_file_id=invoice_uuid,
            )

            if invoice_file is not None:
                mark_invoice_failed(
                    invoice_file=invoice_file,
                    error_message="Invoice processing failed",
                )
                db.commit()

        except Exception:
            db.rollback()

        logger.exception("Invoice processing failed: invoice_file_id=%s", invoice_file_id)

    finally:
        db.close()

        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


def build_invoice_payload(extracted_invoice) -> dict:
    extracted_data = extracted_invoice.model_dump(mode="json")

    return {
        **extracted_data,
        "supplier_name": extracted_data.get("store_name"),
        "invoice_date": extracted_data.get("receipt_date"),
        "currency": "MKD",
        "tax_amount": extracted_data.get("vat_total"),
        "total_amount": extracted_data.get("total"),
        "items": [
            {
                **item,
                "item_name": item.get("product_name"),
                "total_price": item.get("line_total"),
            }
            for item in extracted_data.get("items", [])
        ],
    }
