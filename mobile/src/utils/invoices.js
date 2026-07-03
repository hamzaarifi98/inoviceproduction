import { DEFAULT_CURRENCY } from "../constants";
import { parseMoney } from "./currency";

export function getInvoiceAmount(record) {
  return parseMoney(record.invoice?.total_amount ?? record.amount ?? 0);
}

export function getInvoiceCurrency(record) {
  return record.invoice?.currency || record.currency || DEFAULT_CURRENCY;
}

export function getTotalSpent(records) {
  return records.reduce((sum, record) => sum + getInvoiceAmount(record), 0);
}

export function getUploadMonth(record) {
  return String(record.createdAt || record.invoice?.invoice_date || "").slice(0, 7);
}

export function getAvailableUploadMonths(records) {
  return [...new Set(records.map(getUploadMonth).filter(Boolean))].sort().reverse();
}

export function getMonthLabel(month) {
  if (!month) return "";

  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1, 1);

  if (Number.isNaN(date.getTime())) {
    return month;
  }

  return date.toLocaleDateString("en", { month: "short", year: "numeric" });
}

export function getSpentForUploadMonth(records, month) {
  return records
    .filter((record) => getUploadMonth(record) === month)
    .reduce((sum, record) => sum + getInvoiceAmount(record), 0);
}

export function formatItemMeta(item) {
  const category = item.category || "other";
  const quantity = item.quantity ? `Qty ${item.quantity}` : "";
  const unitPrice = item.unit_price ? `Unit ${item.unit_price}` : "";

  return [category, quantity, unitPrice].filter(Boolean).join(" · ");
}
