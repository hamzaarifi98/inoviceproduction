import json
import os
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI
from sqlalchemy import create_engine, text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

engine = create_engine(DATABASE_URL)
client = OpenAI(api_key=OPENAI_API_KEY)


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
    if not invoices:
        return {
            "nodes": [],
            "relationships": [],
        }

    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": """
You infer Neo4j graph schemas from invoice records stored in Postgres.
Return only valid JSON.
Do not invent fields that do not exist in the provided records.
""",
            },
            {
                "role": "user",
                "content": f"""
Infer a Neo4j graph schema from these invoice records.

Return JSON in this exact shape:

{{
  "nodes": [
    {{
      "label": "Invoice",
      "source": "invoices",
      "key": "id",
      "properties": ["id", "invoice_number", "invoice_date", "total_amount"]
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
- Use useful graph entities like Invoice, Vendor, Customer, LineItem, Tax, Payment, PurchaseOrder.
- Include only fields that exist in the invoice records.
- Relationship types must be uppercase with underscores.
- If the data is flat, infer entities from prefixes like vendor_, customer_, po_, tax_, payment_.
- If a column contains nested JSON, infer child nodes from it.
- Every node needs a stable key field.
- Keep the schema simple and practical for Neo4j.

Invoice records:
{json.dumps(invoices, default=str, indent=2)}
""",
            },
        ],
    )

    content = response.choices[0].message.content
    return json.loads(content)


def extract_graph_schema_from_postgres_invoices(limit: int = 10) -> dict[str, Any]:
    invoices = load_invoices_from_postgres(limit=limit)
    return extract_graph_schema_from_invoices(invoices)


if __name__ == "__main__":
    schema = extract_graph_schema_from_postgres_invoices(limit=10)
    print(json.dumps(schema, indent=2))