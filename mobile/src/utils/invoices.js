import { DEFAULT_CURRENCY } from "../constants";
import { parseMoney } from "./currency";

export function getInvoiceAmount(record) {
  const explicitAmount = parseMoney(record.invoice?.total_amount ?? record.amount ?? 0);

  if (explicitAmount > 0) {
    return explicitAmount;
  }

  const itemsTotal = getInvoiceItemsTotal(record.invoice?.items || []);
  return itemsTotal > 0 ? itemsTotal : explicitAmount;
}

export function getInvoiceItemsTotal(items) {
  return items.reduce((sum, item) => sum + getItemAmount(item), 0);
}

export function getItemAmount(item) {
  const explicitTotal = parseMoney(item?.total_price ?? item?.line_total ?? 0);

  if (explicitTotal > 0) {
    return explicitTotal;
  }

  const unitPrice = parseMoney(item?.unit_price ?? 0);
  const quantity = parseMoney(item?.quantity ?? 0);

  if (unitPrice > 0) {
    return unitPrice * (quantity > 0 ? quantity : 1);
  }

  return 0;
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
