import { API_BASE_URL } from "../config.js";
import { appState } from "../state/store.js";

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (appState.session.token) {
    headers.set("Authorization", `Bearer ${appState.session.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload?.detail
        ? payload.detail
        : "Request failed";
    throw new Error(message);
  }

  return payload;
}

export function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(email, password) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function verifyEmail(email, pin) {
  return request("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ email, pin }),
  });
}

export function uploadInvoice(file) {
  const formData = new FormData();
  formData.append("file", file);

  return request("/invoices/upload", {
    method: "POST",
    body: formData,
  });
}

export function getInvoiceResult(invoiceFileId) {
  return request(`/invoices/files/${invoiceFileId}/result`);
}
