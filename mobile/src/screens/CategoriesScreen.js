import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { Card, EmptyState, StatsCard } from "../components/Card";
import { CategoryRow } from "../components/CategoryRow";
import { styles } from "../styles/styles";
import { money } from "../utils/currency";
import { detectCategory, summarizeCategories } from "../utils/categories";
import { getInvoiceAmount, getInvoiceCurrency, getItemAmount, getTotalSpent } from "../utils/invoices";

export function CategoriesScreen({ invoices, t }) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const processed = invoices.filter((record) => record.invoice);
  const summaries = summarizeCategories(processed);
  const selectedCategoryHasSpend = summaries.some(
    (summary) => summary.id === selectedCategoryId && summary.amount > 0,
  );
  const activeCategoryId = selectedCategoryHasSpend
    ? selectedCategoryId
    : summaries.find((summary) => summary.amount > 0)?.id || "other";
  const selectedDetails = useMemo(
    () => getCategoryDetails(processed, activeCategoryId),
    [processed, activeCategoryId],
  );
  const max = Math.max(...summaries.map((summary) => summary.amount), 1);

  return (
    <>
      <StatsCard items={[
        [t("totalSpend"), money(getTotalSpent(processed))],
        [t("processed"), String(processed.length)],
        [t("pending"), String(invoices.length - processed.length)],
      ]} />
      <Card>
        {processed.length ? summaries.map((summary) => (
          <CategoryRow
            key={summary.id}
            summary={summary}
            max={max}
            isSelected={activeCategoryId === summary.id}
            onPress={() => setSelectedCategoryId(summary.id)}
            t={t}
          />
        )) : <EmptyState title={t("noSpendingYet")} copy={t("spendingByCategory")} />}
      </Card>
      {processed.length > 0 && (
        <Card>
          <Text style={styles.sectionTitle}>{t(activeCategoryId)}</Text>
          <Text style={styles.helperText}>
            {t("categorySpendDetail", { amount: money(selectedDetails.total), count: selectedDetails.items.length })}
          </Text>

          {selectedDetails.items.length ? selectedDetails.items.map((entry, index) => (
            <View key={`${entry.invoiceId}-${entry.name}-${index}`} style={styles.itemRow}>
              <View style={styles.invoiceText}>
                <Text style={styles.itemName}>{entry.name}</Text>
                <Text style={styles.invoiceMeta}>{entry.supplier}</Text>
              </View>
              <Text style={styles.itemPrice}>{money(entry.amount, entry.currency)}</Text>
            </View>
          )) : <EmptyState title={t("noItems")} copy={t("noItemsCopy")} />}
        </Card>
      )}
    </>
  );
}

function getCategoryDetails(records, categoryId) {
  const items = [];

  records.forEach((record) => {
    const invoice = record.invoice || {};
    const invoiceItems = invoice.items || [];
    const recordCategoryId = record.category?.id || detectCategory(invoice).id;

    if (!invoiceItems.length && recordCategoryId === categoryId) {
      items.push({
        invoiceId: record.invoice_file_id,
        name: invoice.supplier_name || record.original_filename || "Invoice",
        supplier: invoice.invoice_date || "",
        amount: getInvoiceAmount(record),
        currency: getInvoiceCurrency(record),
      });
      return;
    }

    invoiceItems.forEach((item) => {
      const itemCategory = String(item.category || recordCategoryId || "other").trim().toLowerCase();

      if (itemCategory === categoryId) {
        items.push({
          invoiceId: record.invoice_file_id,
          name: item.item_name || "Item",
          supplier: invoice.supplier_name || record.original_filename || "Invoice",
          amount: getItemAmount(item),
          currency: getInvoiceCurrency(record),
        });
      }
    });
  });

  return {
    items,
    total: items.reduce((sum, item) => sum + item.amount, 0),
  };
}
