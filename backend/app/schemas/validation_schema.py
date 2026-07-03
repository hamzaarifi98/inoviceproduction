from pydantic import BaseModel, Field
from typing import List, Optional


class ValidationIssue(BaseModel):
    field: str
    message: str
    severity: str  # "low", "medium", "high"


class InvoiceValidationResult(BaseModel):
    invoice_id: Optional[int] = None
    is_valid: bool
    risk_score: float = 0.0
    issues: List[ValidationIssue] = Field(default_factory=list)
