from decimal import Decimal
from typing import Any

from app.graph.connection import get_neo4j_connection
from app.models.document import Document
from app.models.invoice import Invoice


def _to_neo4j_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return value


def upsert_invoice_graph(invoice: Invoice, document: Document | None = None) -> list[dict]:
    neo4j_conn = get_neo4j_connection()

    query = """
    MERGE (i:Invoice {id: $invoice_id})
    SET i.document_id = $document_id,
        i.invoice_number = $invoice_number,
        i.invoice_date = $invoice_date,
        i.due_date = $due_date,
        i.total_amount = $total_amount,
        i.currency = $currency,
        i.status = $status,
        i.validation_status = $validation_status,
        i.risk_score = $risk_score

    WITH i
    FOREACH (_ IN CASE WHEN $vendor_name IS NULL THEN [] ELSE [1] END |
        MERGE (v:Vendor {name: $vendor_name})
        MERGE (v)-[:ISSUED]->(i)
    )

    WITH i
    FOREACH (_ IN CASE WHEN $document_id IS NULL THEN [] ELSE [1] END |
        MERGE (d:Document {id: $document_id})
        SET d.original_filename = $original_filename,
            d.stored_filename = $stored_filename,
            d.file_path = $file_path,
            d.content_type = $content_type
        MERGE (i)-[:EXTRACTED_FROM]->(d)
    )

    RETURN i.id AS invoice_id
    """

    parameters = {
        "invoice_id": invoice.id,
        "document_id": document.id if document else invoice.document_id,
        "invoice_number": invoice.invoice_number,
        "vendor_name": invoice.vendor_name,
        "invoice_date": _to_neo4j_value(invoice.invoice_date),
        "due_date": _to_neo4j_value(invoice.due_date),
        "total_amount": _to_neo4j_value(invoice.total_amount),
        "currency": invoice.currency,
        "status": invoice.status,
        "validation_status": invoice.validation_status,
        "risk_score": _to_neo4j_value(invoice.risk_score),
        "original_filename": document.original_filename if document else None,
        "stored_filename": document.stored_filename if document else None,
        "file_path": document.file_path if document else None,
        "content_type": document.content_type if document else None,
    }

    results = neo4j_conn.execute_query(query, parameters)
    upsert_validation_issues(invoice)
    return results


def upsert_validation_issues(invoice: Invoice) -> list[dict]:
    neo4j_conn = get_neo4j_connection()
    issues = invoice.validation_issues or []

    query = """
    MATCH (i:Invoice {id: $invoice_id})
    OPTIONAL MATCH (i)-[old_rel:HAS_VALIDATION_ISSUE]->(old_issue:ValidationIssue)
    DELETE old_rel, old_issue

    WITH i
    UNWIND $issues AS issue
    CREATE (vi:ValidationIssue)
    SET vi += issue
    MERGE (i)-[:HAS_VALIDATION_ISSUE]->(vi)

    RETURN count(vi) AS issue_count
    """

    return neo4j_conn.execute_query(
        query,
        {
            "invoice_id": invoice.id,
            "issues": issues,
        },
    )


def create_invoice_graph_constraints() -> None:
    neo4j_conn = get_neo4j_connection()

    constraints = [
        "CREATE CONSTRAINT invoice_id IF NOT EXISTS FOR (i:Invoice) REQUIRE i.id IS UNIQUE",
        "CREATE CONSTRAINT vendor_name IF NOT EXISTS FOR (v:Vendor) REQUIRE v.name IS UNIQUE",
        "CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE",
    ]

    for constraint in constraints:
        neo4j_conn.execute_query(constraint)
