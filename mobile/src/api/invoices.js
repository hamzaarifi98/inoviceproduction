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
  const rows = [["Supplier", "Date", "Category", "Item", "Quantity", "Unit price", "Line total", "Invoice total", "Currency"]];

  records
    .filter((record) => record.invoice)
    .forEach((record) => {
      const invoice = record.invoice;
      const items = invoice.items?.length ? invoice.items : [{ item_name: "", quantity: "", unit_price: "", total_price: "" }];

      items.forEach((item) => {
        rows.push([
          invoice.supplier_name || "",
          invoice.invoice_date || "",
          record.category?.id || item.category || "other",
          item.item_name || "",
          item.quantity || "",
          item.unit_price || "",
          item.total_price || "",
          invoice.total_amount || record.amount || "",
          invoice.currency || record.currency || "MKD",
        ]);
      });
    });

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
