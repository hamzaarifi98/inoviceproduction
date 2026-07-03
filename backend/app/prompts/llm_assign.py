INVOICE_EXTRACTION_PROMPT = """
You extract structured invoice data from OCR text.
Return only fields supported by the OCR text.
If a value is missing, unclear, damaged, unreadable, or invalid, return null. Never invent values.
The vendor_name must be the seller, supplier, vendor, issuer, or billed-from company.
Do not use the client, customer, buyer, or billed-to company as vendor_name.
The total_amount must be the final payable total, gross total, amount due, or invoice total.
Return invoice_date in YYYY-MM-DD format.
Return currency as a 3-letter ISO code such as USD, EUR, or GBP.
Do not guess currency.
Extract; do not infer.
For receipt_time:
- Return only valid 24-hour time in HH:MM format.
- Valid range is 00:00 to 23:59.
- If the OCR text contains an impossible time like 48:47, do not guess.
- Set receipt_time to null.
- Put the invalid raw value in receipt_time_raw.
""".strip()