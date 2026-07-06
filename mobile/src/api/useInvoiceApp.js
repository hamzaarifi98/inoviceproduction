import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_API_URL,
  FREE_SCAN_LIMIT,
  INVOICES_KEY,
  LANGUAGE_KEY,
  SCAN_USAGE_KEY,
  SESSION_KEY,
  SUBSCRIPTION_KEY,
} from "../constants";
import { readJson, writeJson } from "../utils/storage";
import { detectCategory } from "../utils/categories";

const REQUEST_TIMEOUT_MS = 10000;
const NO_TIMEOUT = 0;
const DEFAULT_SCAN_USAGE = {
  used_scans: 0,
  free_scan_limit: FREE_SCAN_LIMIT,
  remaining_free_scans: FREE_SCAN_LIMIT,
  is_pro: false,
};

export function useInvoiceApp() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [session, setSession] = useState({ token: "", user: null });
  const [invoices, setInvoices] = useState([]);
  const [scanUsage, setScanUsage] = useState(DEFAULT_SCAN_USAGE);
  const [language, setLanguage] = useState("mk");
  const [subscription, setSubscription] = useState({ plan: "free", activatedAt: null });
  const [isReady, setIsReady] = useState(false);
  const sessionRef = useRef({ token: "", user: null });

  useEffect(() => {
    hydrate();
  }, []);

  async function hydrate() {
    const [savedSession, savedLanguage, savedSubscription] = await Promise.all([
      readJson(SESSION_KEY, { token: "", user: null }),
      AsyncStorage.getItem(LANGUAGE_KEY),
      readJson(SUBSCRIPTION_KEY, { plan: "free", activatedAt: null }),
    ]);
    const cleanApiUrl = DEFAULT_API_URL;
    let nextSession = normalizeSession(savedSession);

    await migrateLegacyGuestInvoices(nextSession.user);

    const savedInvoices = await loadInvoicesForUser(nextSession.user);
    const savedScanCount = countInvoiceScans(savedInvoices);
    const localUsage = await loadScanUsage(nextSession.user, savedScanCount);

    updateSessionState(nextSession);
    setInvoices(savedInvoices);
    setApiUrl(cleanApiUrl);
    setLanguage(savedLanguage || "mk");
    setSubscription(savedSubscription);
    setScanUsage(localUsage);
    setIsReady(true);

    primeSessionInBackground(cleanApiUrl, nextSession).catch((caught) => {
      console.error(`[startup] Could not refresh session data: ${caught.message}`);
    });
  }

  const saveSession = useCallback(async (nextSession) => {
    const previousInvoices = session.user?.is_guest && !nextSession.user?.is_guest ? invoices : [];
    const localInvoices = await loadInvoicesForUser(nextSession.user);
    const savedInvoices = await saveInvoicesForUser(nextSession.user, [
      ...previousInvoices,
      ...localInvoices,
    ]);
    const savedScanCount = countInvoiceScans(savedInvoices);
    const localUsage = await loadScanUsage(nextSession.user, savedScanCount);
    const mergedSession = normalizeSession(nextSession);

    updateSessionState(mergedSession);
    setInvoices(savedInvoices);
    setScanUsage(localUsage);
    await writeJson(SESSION_KEY, mergedSession);

    syncSessionFromServer(apiUrl, mergedSession).catch((caught) => {
      console.error(`[login] Could not refresh account data: ${caught.message}`);
    });
  }, [apiUrl, invoices, session.user]);

  const updateLanguage = useCallback(async (nextLanguage) => {
    setLanguage(nextLanguage);
    await AsyncStorage.setItem(LANGUAGE_KEY, nextLanguage);
  }, []);

  const activatePro = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession.token || activeSession.user?.is_guest) {
      throw new Error("Log in before subscribing to Pro.");
    }

    const { response, payload } = await sendApiRequest(
      `${apiUrl}/auth/subscribe-pro`,
      {
        method: "POST",
        body: JSON.stringify({ plan: "pro_monthly_299" }),
      },
      {
        "Content-Type": "application/json",
        Authorization: `Bearer ${activeSession.token}`,
      },
      45000,
      "Subscription took too long. Please try again.",
      apiUrl,
    );

    if (!response.ok) {
      throw createApiError(response, payload, "Could not activate Pro subscription");
    }

    const nextSession = normalizeSession({
      token: payload.access_token || activeSession.token,
      user: payload.user || {
        ...activeSession.user,
        is_pro: true,
      },
    });
    const nextSubscription = { plan: "pro", activatedAt: new Date().toISOString() };

    updateSessionState(nextSession);
    setSubscription(nextSubscription);
    setScanUsage((current) => {
      const nextUsage = normalizeScanUsage(
        {
          ...current,
          is_pro: true,
        },
        countInvoiceScans(invoices),
      );
      persistScanUsage(nextSession.user, nextUsage);
      return nextUsage;
    });

    await Promise.all([
      writeJson(SUBSCRIPTION_KEY, nextSubscription),
      writeJson(SESSION_KEY, nextSession),
    ]);

    return nextSubscription;
  }, [apiUrl, invoices]);

  const logout = useCallback(async () => {
    const guestInvoices = await loadInvoicesForUser(null);

    updateSessionState({ token: "", user: null });
    setInvoices(guestInvoices);
    setScanUsage(await loadScanUsage(null, countInvoiceScans(guestInvoices)));
    await AsyncStorage.removeItem(SESSION_KEY);
  }, []);

  const request = useCallback(
    async (path, options = {}) => {
      const url = `${apiUrl}${path}`;
      const { timeoutMs = REQUEST_TIMEOUT_MS, timeoutMessage, ...fetchOptions } = options;
      let activeSession = sessionRef.current.token ? sessionRef.current : session;
      const headers = {
        ...(options.headers || {}),
      };

      if (!activeSession.token && requiresSession(path)) {
        activeSession = await createGuestSession(apiUrl);
        updateSessionState(activeSession);
        await writeJson(SESSION_KEY, activeSession);
      }

      if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
      }

      if (activeSession.token) {
        headers.Authorization = `Bearer ${activeSession.token}`;
      }

      console.log(`[api] ${options.method || "GET"} ${url}`);

      let { response, payload } = await sendApiRequest(url, fetchOptions, headers, timeoutMs, timeoutMessage, apiUrl);

      console.log(`[api] ${response.status} ${path}`);

      if (!response.ok && response.status === 401 && activeSession.user?.is_guest) {
        const guestSession = await createGuestSession(apiUrl);
        await writeJson(SESSION_KEY, guestSession);
        updateSessionState(guestSession);

        const retryHeaders = {
          ...headers,
          Authorization: `Bearer ${guestSession.token}`,
        };
        ({ response, payload } = await sendApiRequest(url, fetchOptions, retryHeaders, timeoutMs, timeoutMessage, apiUrl));
        console.log(`[api] ${response.status} ${path} after guest token refresh`);
      }

      if (!response.ok) {
        throw createApiError(response, payload, "Request failed");
      }

      return payload;
    },
    [apiUrl, session.token, session.user],
  );

  function updateSessionState(nextSession) {
    sessionRef.current = nextSession;
    setSession(nextSession);
  }

  async function primeSessionInBackground(cleanApiUrl, initialSession) {
    let activeSession = initialSession;

    if (!activeSession.token) {
      activeSession = await createGuestSession(cleanApiUrl);

      if (sessionRef.current.token) {
        return;
      }

      updateSessionState(activeSession);
      await writeJson(SESSION_KEY, activeSession);
    }

    await syncSessionFromServer(cleanApiUrl, activeSession);
  }

  async function syncSessionFromServer(cleanApiUrl, activeSession) {
    if (!activeSession.token) {
      return;
    }

    let sessionForRequest = activeSession;
    let remoteInvoices = [];

    try {
      remoteInvoices = await fetchInvoiceHistory(cleanApiUrl, sessionForRequest.token);
    } catch (caught) {
      if (caught.status === 401 && sessionForRequest.user?.is_guest) {
        sessionForRequest = await createGuestSession(cleanApiUrl);

        if (!isCurrentSessionUser(activeSession)) {
          return;
        }

        updateSessionState(sessionForRequest);
        await writeJson(SESSION_KEY, sessionForRequest);
      } else if (caught.status !== 404) {
        console.error(`[history] Could not load invoice history: ${caught.message}`);
      }
    }

    const localInvoices = await loadInvoicesForUser(sessionForRequest.user);
    const savedInvoices = await saveInvoicesForUser(sessionForRequest.user, [
      ...localInvoices,
      ...remoteInvoices,
    ]);
    const savedScanCount = countInvoiceScans(savedInvoices);

    if (isCurrentSessionUser(sessionForRequest)) {
      setInvoices(savedInvoices);
    }

    try {
      const remoteUsage = await fetchScanUsage(cleanApiUrl, sessionForRequest.token);
      const nextUsage = await saveScanUsage(sessionForRequest.user, remoteUsage, savedScanCount);

      if (isCurrentSessionUser(sessionForRequest)) {
        setScanUsage(nextUsage);
      }
    } catch (caught) {
      console.error(`[usage] Could not load scan usage: ${caught.message}`);
    }
  }

  function isCurrentSessionUser(nextSession) {
    return isSameSessionUser(sessionRef.current, nextSession);
  }

  const addInvoice = useCallback((record) => {
    setInvoices((current) => {
      const nextInvoices = mergeInvoiceRecords([record, ...current]);
      persistInvoices(session.user, nextInvoices);
      return nextInvoices;
    });
  }, [session.user]);

  const refreshScanUsage = useCallback(async () => {
    if (!session.token) {
      return;
    }
    const remoteUsage = await fetchScanUsage(apiUrl, session.token);
    setScanUsage(await saveScanUsage(session.user, remoteUsage, countInvoiceScans(invoices)));
  }, [apiUrl, invoices, session.token, session.user]);

  const incrementScanUsage = useCallback(() => {
    setScanUsage((current) => {
      const usedScans = current.used_scans + 1;
      const nextUsage = normalizeScanUsage({
        ...current,
        used_scans: usedScans,
      }, countInvoiceScans(invoices) + 1);
      persistScanUsage(session.user, nextUsage);
      return nextUsage;
    });
  }, [invoices, session.user]);

  const updateInvoice = useCallback((invoiceFileId, patch) => {
    setInvoices((current) => {
      const nextInvoices = mergeInvoiceRecords(current.map((invoice) =>
        invoice.invoice_file_id === invoiceFileId
          ? { ...invoice, ...patch, updatedAt: new Date().toISOString() }
          : invoice,
      ));

      persistInvoices(session.user, nextInvoices);
      return nextInvoices;
    });
  }, [session.user]);

  const deleteInvoice = useCallback(async (invoiceFileId, options = {}) => {
    const isManualOnly = options.source === "manual" || String(invoiceFileId).startsWith("manual-");

    if (!isManualOnly) {
      await request(`/invoices/files/${invoiceFileId}`, { method: "DELETE" });
    }

    setInvoices((current) => {
      const nextInvoices = current.filter((invoice) => invoice.invoice_file_id !== invoiceFileId);
      persistInvoices(session.user, nextInvoices);
      return nextInvoices;
    });
  }, [request, session.user]);

  return useMemo(
    () => ({
      apiUrl,
      request,
      session,
      saveSession,
      language,
      updateLanguage,
      subscription,
      activatePro,
      logout,
      invoices,
      scanUsage,
      addInvoice,
      updateInvoice,
      deleteInvoice,
      refreshScanUsage,
      incrementScanUsage,
      isReady,
    }),
    [
      addInvoice,
      apiUrl,
      deleteInvoice,
      invoices,
      isReady,
      incrementScanUsage,
      logout,
      request,
      refreshScanUsage,
      saveSession,
      scanUsage,
      session,
      language,
      updateLanguage,
      subscription,
      activatePro,
      updateInvoice,
    ],
  );
}

function getInvoicesKey(user) {
  return user?.id && !user?.is_guest ? `${INVOICES_KEY}:${user.id}` : INVOICES_KEY;
}

function getLegacyInvoicesKey(user) {
  return user?.id ? `${INVOICES_KEY}:${user.id}` : INVOICES_KEY;
}

function getScanUsageKey(user) {
  return user?.id && !user?.is_guest ? `${SCAN_USAGE_KEY}:${user.id}` : `${SCAN_USAGE_KEY}:guest`;
}

function normalizeSession(savedSession) {
  if (!savedSession || typeof savedSession !== "object") {
    return { token: "", user: null };
  }

  return {
    token: savedSession.token || "",
    user: savedSession.user || null,
  };
}

function isSameSessionUser(leftSession, rightSession) {
  const leftUser = leftSession?.user;
  const rightUser = rightSession?.user;

  return Boolean(leftSession?.token) === Boolean(rightSession?.token)
    && (leftUser?.id || "") === (rightUser?.id || "")
    && Boolean(leftUser?.is_guest) === Boolean(rightUser?.is_guest);
}

function requiresSession(path) {
  return !path.startsWith("/auth/");
}

async function migrateLegacyGuestInvoices(user) {
  if (!user?.is_guest) {
    return;
  }

  const legacyKey = getLegacyInvoicesKey(user);
  if (legacyKey === INVOICES_KEY) {
    return;
  }

  const [stableInvoices, legacyInvoices] = await Promise.all([
    readJson(INVOICES_KEY, []),
    readJson(legacyKey, []),
  ]);

  if (legacyInvoices.length) {
    await writeJson(INVOICES_KEY, mergeInvoiceRecords([...stableInvoices, ...legacyInvoices]));
  }
}

async function loadInvoicesForUser(user) {
  return mergeInvoiceRecords(await readJson(getInvoicesKey(user), []));
}

async function saveInvoicesForUser(user, records) {
  const nextInvoices = mergeInvoiceRecords(records);
  await writeJson(getInvoicesKey(user), nextInvoices);
  return nextInvoices;
}

function persistInvoices(user, records) {
  writeJson(getInvoicesKey(user), mergeInvoiceRecords(records)).catch((caught) => {
    console.error(`[storage] Could not save invoices: ${caught.message}`);
  });
}

async function loadScanUsage(user, invoiceCount) {
  return normalizeScanUsage(await readJson(getScanUsageKey(user), DEFAULT_SCAN_USAGE), invoiceCount);
}

async function saveScanUsage(user, usage, invoiceCount) {
  const nextUsage = normalizeScanUsage(usage, invoiceCount);
  await writeJson(getScanUsageKey(user), nextUsage);
  return nextUsage;
}

function persistScanUsage(user, usage) {
  writeJson(getScanUsageKey(user), usage).catch((caught) => {
    console.error(`[storage] Could not save scan usage: ${caught.message}`);
  });
}

function normalizeScanUsage(usage, scanCount = 0) {
  const freeScanLimit = Number(usage?.free_scan_limit || DEFAULT_SCAN_USAGE.free_scan_limit);
  const usedScans = Math.max(
    Number(usage?.used_scans || 0),
    Number.isFinite(scanCount) ? scanCount : 0,
  );

  return {
    ...DEFAULT_SCAN_USAGE,
    ...usage,
    used_scans: usedScans,
    free_scan_limit: freeScanLimit,
    remaining_free_scans: Math.max(freeScanLimit - usedScans, 0),
    is_pro: Boolean(usage?.is_pro),
  };
}

function mergeInvoiceRecords(records) {
  const byId = new Map();

  records
    .filter((record) => record?.invoice_file_id)
    .forEach((record) => {
      const normalized = normalizeInvoiceRecord(record);
      const existing = byId.get(normalized.invoice_file_id);

      byId.set(
        normalized.invoice_file_id,
        existing ? mergeInvoiceRecord(existing, normalized) : normalized,
      );
    });

  return [...byId.values()].sort((left, right) => {
    const leftTime = new Date(left.updatedAt || left.createdAt || left.invoice?.invoice_date || 0).getTime();
    const rightTime = new Date(right.updatedAt || right.createdAt || right.invoice?.invoice_date || 0).getTime();
    return rightTime - leftTime;
  });
}

function mergeInvoiceRecord(existing, incoming) {
  return {
    ...existing,
    ...incoming,
    invoice: incoming.invoice || existing.invoice || null,
    category: incoming.category || existing.category || null,
    amount: incoming.amount ?? existing.amount,
    currency: incoming.currency || existing.currency,
    error_message: incoming.error_message ?? existing.error_message ?? null,
    createdAt: incoming.createdAt || existing.createdAt,
    updatedAt: incoming.updatedAt || existing.updatedAt,
  };
}

function normalizeInvoiceRecord(record) {
  const invoice = record.invoice || null;

  return {
    ...record,
    invoice,
    invoice_file_id: String(record.invoice_file_id),
    status: record.status || (invoice ? "processed" : "processing"),
    category: record.category || (invoice ? detectCategory(invoice) : null),
    createdAt: record.createdAt || record.created_at || record.uploaded_at || invoice?.invoice_date || new Date().toISOString(),
    updatedAt: record.updatedAt || record.updated_at || record.processed_at || record.createdAt || record.created_at,
    currency: record.currency || invoice?.currency,
    amount: record.amount ?? invoice?.total_amount,
  };
}

function countInvoiceScans(records) {
  return records.filter((record) => record.source !== "manual").length;
}

async function sendApiRequest(url, fetchOptions, headers, timeoutMs, timeoutMessage, apiUrl) {
  let response;
  const controller = new AbortController();
  const timeoutId = timeoutMs === NO_TIMEOUT
    ? null
    : setTimeout(() => controller.abort(), timeoutMs);

  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
  } catch (caught) {
    console.error(`[api] Network error for ${url}: ${caught.message}`);
    if (caught.name === "AbortError") {
      throw new Error(timeoutMessage || "Request took too long. Please check your connection and try again.");
    }

    throw new Error(`Could not reach API server at ${apiUrl}`);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  return {
    response,
    payload: await readResponsePayload(response),
  };
}

async function readResponsePayload(response) {
  const contentType = response.headers.get("content-type") || "";

  try {
    return contentType.includes("application/json")
      ? await response.json()
      : await response.text();
  } catch {
    return "";
  }
}

function createApiError(response, payload, fallbackMessage) {
  const message = typeof payload === "object" && payload?.detail ? payload.detail : fallbackMessage;
  const error = new Error(message);
  error.status = response.status;
  return error;
}

async function createGuestSession(apiUrl) {
  const response = await fetch(`${apiUrl}/auth/guest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw createApiError(response, payload, "Could not start guest session");
  }

  return {
    token: payload.access_token,
    user: payload.user,
  };
}

async function fetchInvoiceHistory(apiUrl, token) {
  const response = await fetch(`${apiUrl}/invoices/history`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw createApiError(response, payload, "Could not load invoice history");
  }

  return Array.isArray(payload) ? payload : [];
}

async function fetchScanUsage(apiUrl, token) {
  const response = await fetch(`${apiUrl}/invoices/usage`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw createApiError(response, payload, "Could not load scan usage");
  }

  return payload;
}
