import { Platform } from "react-native";

export const SESSION_KEY = "invoice_app_session";
export const INVOICES_KEY = "invoice_app_invoices";
export const API_KEY = "invoice_api_base_url";
export const LANGUAGE_KEY = "invoice_app_language";
export const SUBSCRIPTION_KEY = "invoice_app_subscription";
export const DEFAULT_CURRENCY = "MKD";
export const FREE_SCAN_LIMIT = 5;
export const DEFAULT_API_URL =
  Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000";

export const routeLabels = {
  dashboard: "dashboard",
  login: "login",
  upload: "scanInvoice",
  categories: "categories",
  history: "invoices",
};

export const tabs = [
  ["dashboard", "homeTab"],
  ["upload", "scanTab"],
  ["categories", "spendTab"],
  ["history", "listTab"],
];
