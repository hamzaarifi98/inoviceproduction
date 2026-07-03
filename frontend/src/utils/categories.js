import { parseMoney } from "./currency.js";
import { getInvoiceAmount } from "./invoices.js";

export const categories = [
  { id: "food", label: "Food", color: "#24a47a", match: ["food", "market", "restaurant", "cafe", "pizza", "burger", "bread"] },
  { id: "clothes", label: "Clothes", color: "#7c5cff", match: ["shirt", "dress", "jeans", "clothes", "fashion", "wear"] },
  { id: "car", label: "Car", color: "#f08a24", match: ["fuel", "gas", "petrol", "diesel", "garage", "auto", "car"] },
  { id: "home", label: "Home", color: "#3182ce", match: ["home", "furniture", "cleaning", "kitchen", "garden"] },
  { id: "health", label: "Health", color: "#d6456a", match: ["pharmacy", "doctor", "medical", "health"] },
  { id: "other", label: "Other", color: "#637083", match: [] },
];

export function detectCategory(invoice) {
  const text = [
    invoice?.supplier_name,
    invoice?.invoice_number,
    ...(invoice?.items || []).map((item) => item.item_name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    categories.find((category) =>
      category.match.some((keyword) => text.includes(keyword)),
    ) || categories.at(-1)
  );
}

export function summarizeCategories(invoices) {
  const totals = new Map(
    categories.map((category) => [
      category.id,
      { ...category, amount: 0, count: 0 },
    ]),
  );

  invoices.forEach((record) => {
    const invoice = record.invoice || {};
    const items = invoice.items || [];

    if (!items.length) {
      const category = record.category || detectCategory(invoice);
      const total = getInvoiceAmount(record);
      const summary = totals.get(category.id) || totals.get("other");

      summary.amount += Number.isFinite(total) ? total : 0;
      summary.count += 1;
      return;
    }

    items.forEach((item) => {
      const categoryId = normalizeCategoryId(item.category);
      const total = parseMoney(item.total_price || 0);
      const summary = totals.get(categoryId) || totals.get("other");

      summary.amount += Number.isFinite(total) ? total : 0;
      summary.count += 1;
    });
  });

  return [...totals.values()];
}

function normalizeCategoryId(category) {
  const categoryId = String(category || "other").trim().toLowerCase();
  return categories.some((item) => item.id === categoryId) ? categoryId : "other";
}
