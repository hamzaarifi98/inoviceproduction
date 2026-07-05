INVOICE_EXTRACTION_PROMPT = """
You extract structured invoice data from OCR text.
Return only fields supported by the OCR text.
If a value is missing, unclear, damaged, unreadable, or invalid, return null. Never invent values.
If there is extracted items json exactly like this schema:
ЕТИ поп кек банана 35гр
KOM
1,0
24,00
11,81
283,43: this is without tax
5
0,59
12,40
297,60: this is total -> So you extract the total as this one.
18 038258
For each item:
- If the product name is visible but the price is unclear, set line_total to null.
- Do not invent prices.
- If quantity and unit_price are visible but line_total is missing, you may calculate line_total as quantity * unit_price.
- If a row is not a real product item, do not include it in items.
The vendor_name must be the seller, supplier, vendor, issuer, or billed-from company.
Do not use the client, customer, buyer, or billed-to company as vendor_name.
The total_amount must be the final payable total, gross total, amount due, or invoice total, in macedonian
it muset Вредност со ддв(Vrednost so ddv) or Вкупно со ддв(Vkupno so ddv) or Вкупно(Vkupno) or Вкупна сума(Vkupna suma) or Вкупно за плаќање(Vkupno za plakanje) or Вкупно за наплата(Vkupno za naplata) or Вкупно за плаќање со ддв(Vkupno za plakanje so ddv) or Вкупно за наплата со ддв(Vkupno za naplata so ddv).
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