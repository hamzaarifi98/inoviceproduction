import { getInvoiceCategoryId, getItemCategoryId, getRecordCategoryId } from "../utils/categories";

export async function pollForResult(request, invoiceFileId, setStatus) {
  const maxAttempts = 60;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await request(`/invoices/files/${invoiceFileId}/result`);

    if (result.status === "processed" || result.status === "failed") {
      return result;
    }

    setStatus(`Extracting data... ${attempt + 1}/${maxAttempts}`);
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  return request(`/invoices/files/${invoiceFileId}/result`);
}

export function invoiceSummaryCsvRows(records) {
  const rows = [[
    "Invoice number",
    "Supplier",
    "Date",
    "Subtotal (without tax)",
    "Tax",
    "Total (with tax)",
    "Currency",
  ]];

  records
    .filter((record) => record.invoice)
    .forEach((record) => {
      const invoice = record.invoice;
      rows.push([
        invoice.invoice_number || "",
        invoice.supplier_name || "",
        invoice.invoice_date || "",
        invoice.subtotal || "",
        invoice.tax_amount || "",
        invoice.total_amount || record.amount || "",
        invoice.currency || record.currency || "MKD",
      ]);
    });

  return rowsToCsv(rows);
}

export function invoiceItemsCsvRows(records) {
  const rows = [[
    "Invoice number",
    "Supplier",
    "Date",
    "Category",
    "Item",
    "Quantity",
    "Unit price",
    "Item total",
    "Currency",
  ]];

  records
    .filter((record) => record.invoice)
    .forEach((record) => {
      const invoice = record.invoice;
      const items = invoice.items?.length ? invoice.items : [null];

      items.forEach((item) => {
        rows.push([
          invoice.invoice_number || "",
          invoice.supplier_name || "",
          invoice.invoice_date || "",
          item ? getItemCategoryId(record, item) : getRecordCategoryId(record),
          item?.item_name || item?.name || "",
          item?.quantity || "",
          item?.unit_price || "",
          item?.total_price || item?.line_total || "",
          invoice.currency || record.currency || "MKD",
        ]);
      });
    });

  return rowsToCsv(rows);
}

export function invoiceCategoryCsvRows(records) {
  const rows = [[
    "Category",
    "Invoice number",
    "Supplier",
    "Date",
    "Total (with tax)",
    "Currency",
  ]];

  records
    .filter((record) => record.invoice)
    .map((record) => ({ record, category: getInvoiceCategoryId(record) }))
    .sort((a, b) => a.category.localeCompare(b.category))
    .forEach(({ record, category }) => {
      const invoice = record.invoice;
      rows.push([
        category,
        invoice.invoice_number || "",
        invoice.supplier_name || "",
        invoice.invoice_date || "",
        invoice.total_amount || record.amount || "",
        invoice.currency || record.currency || "MKD",
      ]);
    });

  return rowsToCsv(rows);
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
