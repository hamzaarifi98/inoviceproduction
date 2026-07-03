import { DEFAULT_CURRENCY, parseMoney } from "./currency.js";

export function getInvoiceAmount(record) {
  return parseMoney(record.invoice?.total_amount ?? record.amount ?? 0);
}

export function getInvoiceCurrency(record) {
  return record.invoice?.currency || record.currency || DEFAULT_CURRENCY;
}

export function getTotalSpent(records) {
  return records.reduce((sum, record) => sum + getInvoiceAmount(record), 0);
}

export function isFinished(record) {
  return record.status === "processed" || record.status === "failed";
}
