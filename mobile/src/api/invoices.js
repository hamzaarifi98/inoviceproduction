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

export function invoiceToCsvRows(records) {
  const rows = [[
    "Invoice file ID",
    "Invoice number",
    "Supplier",
    "Date",
    "Status",
    "Category",
    "Item",
    "Quantity",
    "Unit price",
    "Line total",
    "Subtotal",
    "Tax",
    "Invoice total",
    "Currency",
  ]];

  records
    .filter((record) => record.invoice)
    .forEach((record) => {
      const invoice = record.invoice;
      const items = invoice.items?.length
        ? invoice.items
        : [{ item_name: "", quantity: "", unit_price: "", total_price: "", category: record.category?.id }];

      items.forEach((item) => {
        rows.push([
          record.invoice_file_id || invoice.invoice_file_id || "",
          invoice.invoice_number || "",
          invoice.supplier_name || "",
          invoice.invoice_date || "",
          record.status || "",
          record.category?.id || item.category || "other",
          item.item_name || item.name || "",
          item.quantity || "",
          item.unit_price || "",
          item.total_price || item.line_total || "",
          invoice.subtotal || "",
          invoice.tax_amount || "",
          invoice.total_amount || record.amount || "",
          invoice.currency || record.currency || "MKD",
        ]);
      });
    });

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
