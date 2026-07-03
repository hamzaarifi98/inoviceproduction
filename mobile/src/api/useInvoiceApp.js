import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  API_KEY,
  DEFAULT_API_URL,
  INVOICES_KEY,
  LANGUAGE_KEY,
  SESSION_KEY,
  SUBSCRIPTION_KEY,
} from "../constants";
import { readJson, writeJson } from "../utils/storage";

const REQUEST_TIMEOUT_MS = 10000;
const NO_TIMEOUT = 0;

export function useInvoiceApp() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [session, setSession] = useState({ token: "", user: null });
  const [invoices, setInvoices] = useState([]);
  const [scanUsage, setScanUsage] = useState({ used_scans: 0, free_scan_limit: 5, remaining_free_scans: 5, is_pro: false });
  const [language, setLanguage] = useState("mk");
  const [subscription, setSubscription] = useState({ plan: "free", activatedAt: null });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    hydrate();
  }, []);

  async function hydrate() {
    const [savedSession, savedApiUrl, savedLanguage, savedSubscription] = await Promise.all([
      readJson(SESSION_KEY, { token: "", user: null }),
      AsyncStorage.getItem(API_KEY),
      AsyncStorage.getItem(LANGUAGE_KEY),
      readJson(SUBSCRIPTION_KEY, { plan: "free", activatedAt: null }),
    ]);
    const cleanApiUrl = savedApiUrl || DEFAULT_API_URL;
    let nextSession = savedSession;

    if (!nextSession.token) {
      try {
        nextSession = await createGuestSession(cleanApiUrl);
        await writeJson(SESSION_KEY, nextSession);
      } catch (caught) {
        console.error(`[auth] Could not create guest session: ${caught.message}`);
      }
    }

    const savedInvoices = await readJson(getInvoicesKey(nextSession.user), []);

    setSession(nextSession);
    setInvoices(savedInvoices);
    setApiUrl(cleanApiUrl);
    setLanguage(savedLanguage || "mk");
    setSubscription(savedSubscription);
    setIsReady(true);

    if (nextSession.token) {
      fetchScanUsage(cleanApiUrl, nextSession.token).then(setScanUsage).catch((caught) => {
        console.error(`[usage] Could not load scan usage: ${caught.message}`);
      });
    }
  }

  const updateApiUrl = useCallback(async (nextApiUrl) => {
    const cleanUrl = nextApiUrl.trim().replace(/\/$/, "");
    setApiUrl(cleanUrl);
    await AsyncStorage.setItem(API_KEY, cleanUrl);
  }, []);

  const saveSession = useCallback(async (nextSession) => {
    const savedInvoices = await readJson(getInvoicesKey(nextSession.user), []);
    setSession(nextSession);
    setInvoices(savedInvoices);
    await writeJson(SESSION_KEY, nextSession);
    try {
      setScanUsage(await fetchScanUsage(apiUrl, nextSession.token));
    } catch (caught) {
      console.error(`[usage] Could not load scan usage after login: ${caught.message}`);
    }
  }, [apiUrl]);

  const updateLanguage = useCallback(async (nextLanguage) => {
    setLanguage(nextLanguage);
    await AsyncStorage.setItem(LANGUAGE_KEY, nextLanguage);
  }, []);

  const activatePro = useCallback(async () => {
    const nextSubscription = { plan: "pro", activatedAt: new Date().toISOString() };
    setSubscription(nextSubscription);
    await writeJson(SUBSCRIPTION_KEY, nextSubscription);
  }, []);

  const logout = useCallback(async () => {
    try {
      const guestSession = await createGuestSession(apiUrl);
      const guestInvoices = await readJson(getInvoicesKey(guestSession.user), []);
      setSession(guestSession);
      setInvoices(guestInvoices);
      await writeJson(SESSION_KEY, guestSession);
      setScanUsage(await fetchScanUsage(apiUrl, guestSession.token));
    } catch (caught) {
      console.error(`[auth] Could not create guest session after logout: ${caught.message}`);
      setSession({ token: "", user: null });
      setInvoices([]);
      await AsyncStorage.removeItem(SESSION_KEY);
    }
  }, [apiUrl]);

  const request = useCallback(
    async (path, options = {}) => {
      const url = `${apiUrl}${path}`;
      const { timeoutMs = REQUEST_TIMEOUT_MS, ...fetchOptions } = options;
      const headers = {
        ...(options.headers || {}),
      };

      if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
      }

      if (session.token) {
        headers.Authorization = `Bearer ${session.token}`;
      }

      console.log(`[api] ${options.method || "GET"} ${url}`);

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
          throw new Error("Upload took too long. Please try again with a smaller file or better connection.");
        }

        throw new Error(`Could not reach API server at ${apiUrl}`);
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }

      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      console.log(`[api] ${response.status} ${path}`);

      if (!response.ok) {
        const message = typeof payload === "object" && payload?.detail ? payload.detail : "Request failed";
        throw new Error(message);
      }

      return payload;
    },
    [apiUrl, session.token],
  );

  const addInvoice = useCallback((record) => {
    setInvoices((current) => {
      const nextInvoices = [record, ...current];
      writeJson(getInvoicesKey(session.user), nextInvoices);
      return nextInvoices;
    });
  }, [session.user]);

  const refreshScanUsage = useCallback(async () => {
    if (!session.token) {
      return;
    }
    setScanUsage(await fetchScanUsage(apiUrl, session.token));
  }, [apiUrl, session.token]);

  const incrementScanUsage = useCallback(() => {
    setScanUsage((current) => {
      const usedScans = current.used_scans + 1;
      return {
        ...current,
        used_scans: usedScans,
        remaining_free_scans: Math.max((current.free_scan_limit || 5) - usedScans, 0),
      };
    });
  }, []);

  const updateInvoice = useCallback((invoiceFileId, patch) => {
    setInvoices((current) => {
      const nextInvoices = current.map((invoice) =>
        invoice.invoice_file_id === invoiceFileId
          ? { ...invoice, ...patch, updatedAt: new Date().toISOString() }
          : invoice,
      );

      writeJson(getInvoicesKey(session.user), nextInvoices);
      return nextInvoices;
    });
  }, [session.user]);

  const deleteInvoice = useCallback((invoiceFileId) => {
    setInvoices((current) => {
      const nextInvoices = current.filter((invoice) => invoice.invoice_file_id !== invoiceFileId);
      writeJson(getInvoicesKey(session.user), nextInvoices);
      return nextInvoices;
    });
  }, [session.user]);

  return useMemo(
    () => ({
      apiUrl,
      updateApiUrl,
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
      updateApiUrl,
      updateInvoice,
    ],
  );
}

function getInvoicesKey(user) {
  return user?.id ? `${INVOICES_KEY}:${user.id}` : INVOICES_KEY;
}

async function createGuestSession(apiUrl) {
  const response = await fetch(`${apiUrl}/auth/guest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = typeof payload === "object" && payload?.detail ? payload.detail : "Could not start guest session";
    throw new Error(message);
  }

  return {
    token: payload.access_token,
    user: payload.user,
  };
}

async function fetchScanUsage(apiUrl, token) {
  const response = await fetch(`${apiUrl}/invoices/usage`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = typeof payload === "object" && payload?.detail ? payload.detail : "Could not load scan usage";
    throw new Error(message);
  }

  return payload;
}
