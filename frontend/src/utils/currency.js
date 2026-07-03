export const DEFAULT_CURRENCY = "MKD";

export function money(value, currency = DEFAULT_CURRENCY) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0.00";
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
  const number = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}
