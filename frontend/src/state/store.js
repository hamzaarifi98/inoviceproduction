const SESSION_KEY = "invoice_app_session";
const INVOICES_KEY = "invoice_app_invoices";

const listeners = new Set();

export const appState = {
  route: "dashboard",
  session: {
    token: "",
    user: null,
  },
  invoices: [],
};

export function hydrateSession() {
  appState.session = readJson(SESSION_KEY, appState.session);
  appState.invoices = readJson(getInvoicesKey(), []);
}

export function setSession(session) {
  appState.session = {
    token: session.access_token,
    user: session.user,
  };
  appState.invoices = readJson(getInvoicesKey(), []);
  localStorage.setItem(SESSION_KEY, JSON.stringify(appState.session));
  notify();
}

export function logout() {
  appState.session = { token: "", user: null };
  appState.invoices = [];
  appState.route = "dashboard";
  localStorage.removeItem(SESSION_KEY);
  notify();
}

export function addInvoice(invoice) {
  appState.invoices = [invoice, ...appState.invoices];
  persistInvoices();
  notify();
}

export function updateInvoice(invoiceFileId, patch) {
  appState.invoices = appState.invoices.map((invoice) =>
    invoice.invoice_file_id === invoiceFileId
      ? { ...invoice, ...patch, updatedAt: new Date().toISOString() }
      : invoice,
  );
  persistInvoices();
  notify();
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function persistInvoices() {
  localStorage.setItem(getInvoicesKey(), JSON.stringify(appState.invoices));
}

function notify() {
  listeners.forEach((listener) => listener());
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function getInvoicesKey() {
  const userId = appState.session.user?.id;
  return userId ? `${INVOICES_KEY}:${userId}` : INVOICES_KEY;
}
