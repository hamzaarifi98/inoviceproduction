import { mobileShell } from "../components/layout.js";
import { card, emptyState, stat } from "../components/ui.js";
import { appState } from "../state/store.js";
import { syncPendingInvoices } from "../state/invoiceSync.js";
import { summarizeCategories } from "../utils/categories.js";
import { money } from "../utils/currency.js";
import { getTotalSpent } from "../utils/invoices.js";

export function renderCategoriesScreen() {
  syncPendingInvoices();

  const processed = appState.invoices.filter((record) => record.invoice);
  const summaries = summarizeCategories(processed);
  const max = Math.max(...summaries.map((item) => item.amount), 1);
  const total = getTotalSpent(processed);
  const pendingCount = appState.invoices.length - processed.length;

  const children = processed.length
    ? summaries.map((summary) => categoryRow(summary, max))
    : [emptyState("No spending yet", "Processed invoices will appear by category here.")];

  const summary = card([
    stat("Total spend", money(total)),
    stat("Processed", String(processed.length)),
    stat("Pending", String(pendingCount)),
  ], "dashboard-summary");

  return mobileShell("Categories", [summary, card(children, "category-list")]);
}

function categoryRow(summary, max) {
  const row = document.createElement("div");
  row.className = "category-row";
  const width = Math.max((summary.amount / max) * 100, summary.amount ? 8 : 0);

  row.innerHTML = `
    <div class="category-meta">
      <span style="background:${summary.color}"></span>
      <strong>${summary.label}</strong>
      <small>${summary.count} items</small>
      <b>${money(summary.amount)}</b>
    </div>
    <div class="category-bar"><i style="width:${width}%; background:${summary.color}"></i></div>
  `;

  return row;
}
