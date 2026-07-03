from app.schemas.validation_schema import InvoiceValidationResult, ValidationIssue



class InvoiceValidationService:
    def __init__(self, db=None):
        self.db = db

    def validate(self, invoice_data, invoice_id=None):
        issues = []

        if not invoice_data.vendor_name:
            issues.append(ValidationIssue(
                field="vendor_name",
                message="Vendor name is missing",
                severity="high",
            ))

        if invoice_data.total_amount is None:
            issues.append(ValidationIssue(
                field="total_amount",
                message="Total amount is missing",
                severity="high",
            ))
        elif invoice_data.total_amount <= 0:
            issues.append(ValidationIssue(
                field="total_amount",
                message="Total amount must be greater than zero",
                severity="high",
            ))

        if invoice_data.currency and invoice_data.currency not in {"USD", "EUR", "GBP"}:
            issues.append(ValidationIssue(
                field="currency",
                message="Currency is not supported",
                severity="medium",
            ))

        if invoice_data.invoice_date and invoice_data.due_date:
            if invoice_data.due_date < invoice_data.invoice_date:
                issues.append(ValidationIssue(
                    field="due_date",
                    message="Due date cannot be before invoice date",
                    severity="high",
                ))

        return InvoiceValidationResult(
            invoice_id=invoice_id,
            is_valid=not any(issue.severity == "high" for issue in issues),
            risk_score=self._risk_score(issues),
            issues=issues,
        )

    def _risk_score(self, issues):
        weights = {
            "low": 0.1,
            "medium": 0.3,
            "high": 0.5,
        }

        return min(
            sum(weights.get(issue.severity, 0.0) for issue in issues),
            1.0,
        )
