import json
import os
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI
from sqlalchemy import create_engine, text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

engine = create_engine(DATABASE_URL)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def load_invoices_from_postgres(limit: int = 10) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                SELECT *
                FROM invoices
                ORDER BY id DESC
                LIMIT :limit
            """),
            {"limit": limit},
        )

        return [dict(row._mapping) for row in result]


def extract_graph_schema_from_invoices(invoices: list[dict[str, Any]]) -> dict[str, Any]:
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": "You infer Neo4j graph schemas from invoice database records.",
            },
            {
                "role": "user",
                "content": f"""
I have invoice records from Postgres.

Infer a Neo4j graph schema from the actual invoice data.

Return ONLY JSON in this format:

{{
  "nodes": [
    {{
      "label": "Invoice",
      "source": "invoices",
      "key": "id",
      "properties": ["id", "invoice_number", "invoice_date", "total_amount", "currency"]
    }},
    {{
      "label": "Vendor",
      "source": "invoices",
      "key": "vendor_name",
      "properties": ["vendor_name", "vendor_tax_id", "vendor_address"]
    }}
  ],
  "relationships": [
    {{
      "type": "ISSUED_BY",
      "from_label": "Invoice",
      "to_label": "Vendor",
      "from_key": "id",
      "to_key": "vendor_name",
      "description": "Invoice was issued by vendor"
    }}
  ]
}}

Rules:
- Use the invoice fields to identify useful graph entities.
- Prefer entities like Invoice, Vendor, Customer, LineItem, Tax, Payment, PurchaseOrder.
- Do not invent fields that do not exist in the records.
- Relationship types must be uppercase_WITH_UNDERSCORES.
- Include only properties that exist in the input data.
- If the data is flat, infer entities from field prefixes like vendor_, customer_, po_, tax_, payment_.
- If a field contains nested JSON, use it to infer child nodes like LineItem.

Invoice records:
{json.dumps(invoices, default=str, indent=2)}
""",
            },
        ],
    )

    return json.loads(response.choices[0].message.content)


def extract_graph_schema_from_postgres_invoices(limit: int = 10) -> dict[str, Any]:
    invoices = load_invoices_from_postgres(limit=limit)
    return extract_graph_schema_from_invoices(invoices)