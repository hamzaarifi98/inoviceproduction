import { DEFAULT_CURRENCY } from "../constants";

export function money(value, currency = DEFAULT_CURRENCY) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return `${currency} 0.00`;
  }

  try {
    return new Intl.NumberFormat("mk-MK", {
      style: "currency",
      currency: currency || DEFAULT_CURRENCY,
    }).format(number);
  } catch {
    return `${currency || ""} ${number.toFixed(2)}`.trim();
  }
}

export function parseMoney(value) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).trim().replace(/[^0-9,.-]/g, "");
  const normalized = normalizeMoneyText(cleaned);
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function normalizeMoneyText(value) {
  if (!value || value === "-") {
    return "0";
  }

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";

    return value
      .replaceAll(thousandsSeparator, "")
      .replace(decimalSeparator, ".");
  }

  if (lastComma !== -1) {
    return normalizeSingleSeparator(value, ",");
  }

  return normalizeSingleSeparator(value, ".");
}

function normalizeSingleSeparator(value, separator) {
  const parts = value.split(separator);

  if (parts.length === 1) {
    return value;
  }

  const decimalPart = parts[parts.length - 1];
  const integerPart = parts.slice(0, -1).join("");

  if (separator === "." && parts.length === 2) {
    return value;
  }

  if (decimalPart.length === 1 || decimalPart.length === 2) {
    return `${integerPart}.${decimalPart}`;
  }

  return `${integerPart}${decimalPart}`;
}
