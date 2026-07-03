import { mobileShell } from "../components/layout.js";
import { card, emptyState, stat } from "../components/ui.js";
import { appState } from "../state/store.js";
import { syncPendingInvoices } from "../state/invoiceSync.js";
import { money } from "../utils/currency.js";
import { getInvoiceAmount, getInvoiceCurrency, getTotalSpent } from "../utils/invoices.js";

const expandedInvoices = new Set();

export function renderHistoryScreen() {
  syncPendingInvoices();

  const processed = appState.invoices.filter((record) => record.invoice);
  const children = appState.invoices.length
    ? appState.invoices.map(historyItem)
    : [emptyState("History is empty", "Every uploaded invoice will be saved here on this device.")];
  const summary = card([
    stat("Total spend", money(getTotalSpent(processed))),
    stat("Processed", String(processed.length)),
    stat("All invoices", String(appState.invoices.length)),
  ], "dashboard-summary");

  return mobileShell("Invoices", [summary, card(children, "history-list")]);
}

function historyItem(record) {
  const item = document.createElement("article");
  item.className = "history-item";
  const invoice = record.invoice || {};
  const category = record.category?.label || "Unsorted";
  const amount = record.invoice
    ? money(getInvoiceAmount(record), getInvoiceCurrency(record))
    : "Extracting";
  const invoiceId = record.invoice_file_id || record.createdAt || record.original_filename;
  const isExpanded = expandedInvoices.has(invoiceId);

  item.innerHTML = `
    <button class="history-summary" type="button" aria-expanded="${isExpanded}">
      <div>
        <strong>${invoice.supplier_name || record.original_filename || "Invoice"}</strong>
        <span>${category} · ${record.status}</span>
      </div>
      <b>${amount}</b>
    </button>
  `;

  const summary = item.querySelector(".history-summary");
  summary.addEventListener("click", () => {
    if (!record.invoice) return;

    if (expandedInvoices.has(invoiceId)) {
      expandedInvoices.delete(invoiceId);
    } else {
      expandedInvoices.add(invoiceId);
    }

    item.replaceWith(historyItem(record));
  });

  if (isExpanded && record.invoice) {
    item.append(invoiceItems(record));
  }

  return item;
}

function invoiceItems(record) {
  const items = record.invoice?.items || [];
  const list = document.createElement("div");
  list.className = "invoice-items";

  if (!items.length) {
    list.append(emptyState("No items extracted", "This invoice has no item lines saved."));
    return list;
  }

  items.forEach((invoiceItem) => {
    const row = document.createElement("div");
    row.className = "invoice-item-row";
    row.innerHTML = `
      <div>
        <strong>${invoiceItem.item_name || "Item"}</strong>
        <span>${formatItemMeta(invoiceItem)}</span>
      </div>
      <b>${money(invoiceItem.total_price, getInvoiceCurrency(record))}</b>
    `;
    list.append(row);
  });

  return list;
}

function formatItemMeta(item) {
  const category = item.category || "other";
  const quantity = item.quantity ? `Qty ${item.quantity}` : "";
  const unitPrice = item.unit_price ? `Unit ${item.unit_price}` : "";

  return [category, quantity, unitPrice].filter(Boolean).join(" · ");
}
