import json
import logging
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.crud.invoice_processing_logs import create_invoice_processing_log


logger = logging.getLogger(__name__)


def log_pipeline_event(
    db: Session,
    invoice_file_id: UUID,
    stage: str,
    *,
    status: str = "info",
    message: str | None = None,
    duration_ms: int | None = None,
    metadata: dict[str, Any] | None = None,
    commit: bool = False,
) -> None:
    safe_metadata = _json_safe(metadata)
    create_invoice_processing_log(
        db=db,
        invoice_file_id=invoice_file_id,
        stage=stage,
        status=status,
        message=message,
        duration_ms=duration_ms,
        metadata=safe_metadata,
    )
    logger.info(
        "Invoice pipeline event: invoice_file_id=%s stage=%s status=%s duration_ms=%s message=%s",
        invoice_file_id,
        stage,
        status,
        duration_ms,
        message,
    )
    if commit:
        db.commit()


def _json_safe(metadata: dict[str, Any] | None) -> dict[str, Any] | None:
    if metadata is None:
        return None
    return json.loads(json.dumps(metadata, default=str))
