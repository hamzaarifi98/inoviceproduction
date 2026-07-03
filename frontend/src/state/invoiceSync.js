import { getInvoiceResult } from "../api/client.js";
import { updateInvoice, appState } from "./store.js";
import { detectCategory } from "../utils/categories.js";
import { DEFAULT_CURRENCY } from "../utils/currency.js";
import { getInvoiceAmount, isFinished } from "../utils/invoices.js";

let isSyncing = false;
let syncTimer = null;

export async function syncPendingInvoices() {
  if (isSyncing || !appState.session.token) return;

  clearScheduledSync();

  const pending = appState.invoices.filter(
    (record) =>
      record.invoice_file_id &&
      (!isFinished(record) || needsCategoryRefresh(record)),
  );

  if (!pending.length) return;

  isSyncing = true;

  try {
    for (const record of pending) {
      await syncInvoice(record.invoice_file_id);
    }
  } finally {
    isSyncing = false;
  }

  const stillPending = appState.invoices.some(
    (record) => record.invoice_file_id && !isFinished(record),
  );

  if (stillPending) {
    syncTimer = window.setTimeout(syncPendingInvoices, 3000);
  }
}

function clearScheduledSync() {
  if (!syncTimer) return;
  window.clearTimeout(syncTimer);
  syncTimer = null;
}

function needsCategoryRefresh(record) {
  if (record.categoryRefreshAttempted || record.status !== "processed") {
    return false;
  }

  const items = record.invoice?.items;

  return (
    !Array.isArray(items) ||
    !items.length ||
    items.some((item) => !item.category)
  );
}

async function syncInvoice(invoiceFileId) {
  try {
    const result = await getInvoiceResult(invoiceFileId);

    if (result.invoice) {
      const category = detectCategory(result.invoice);
      updateInvoice(invoiceFileId, {
        status: result.status,
        invoice: result.invoice,
        category,
        amount: getInvoiceAmount({ invoice: result.invoice }),
        currency: result.invoice.currency || DEFAULT_CURRENCY,
        error_message: null,
        categoryRefreshAttempted: true,
      });
      return;
    }

    updateInvoice(invoiceFileId, {
      status: result.status,
      error_message: result.error_message || null,
      categoryRefreshAttempted: true,
    });
  } catch (error) {
    updateInvoice(invoiceFileId, {
      sync_error: error.message,
    });
  }
}
