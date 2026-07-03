import { mobileShell } from "../components/layout.js";
import { card, emptyState, stat } from "../components/ui.js";
import { appState } from "../state/store.js";
import { syncPendingInvoices } from "../state/invoiceSync.js";
import { money } from "../utils/currency.js";
import { summarizeCategories } from "../utils/categories.js";
import { getInvoiceAmount, getInvoiceCurrency, getTotalSpent } from "../utils/invoices.js";

export function renderDashboardScreen() {
  syncPendingInvoices();

  const processed = appState.invoices.filter((record) => record.invoice);
  const total = getTotalSpent(processed);
  const topCategory = summarizeCategories(processed)
    .sort((a, b) => b.amount - a.amount)
    .at(0);
  const pendingCount = appState.invoices.filter((record) => !record.invoice).length;

  const hero = card([
    stat("Total spend", money(total)),
    stat("Invoices", String(appState.invoices.length)),
    stat("Pending", String(pendingCount)),
  ], "dashboard-summary");

  const recent = card([
    sectionTitle("Recent invoices"),
    ...appState.invoices.slice(0, 3).map(invoiceRow),
    appState.invoices.length
      ? document.createTextNode("")
      : emptyState("No invoices yet", "Upload your first invoice from the Scan tab."),
  ]);

  return mobileShell("Dashboard", [hero, recent]);
}

function sectionTitle(text) {
  const element = document.createElement("h2");
  element.className = "section-title";
  element.textContent = text;
  return element;
}

function invoiceRow(record) {
  const amount = record.invoice ? money(getInvoiceAmount(record), getInvoiceCurrency(record)) : "Extracting";

  const row = document.createElement("div");
  row.className = "invoice-row";
  row.innerHTML = `
    <div>
      <strong>${record.invoice?.supplier_name || record.original_filename}</strong>
      <span>${record.invoice ? record.category?.label || "Other" : record.status}</span>
    </div>
    <b>${amount}</b>
  `;
  return row;
}
