import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Card, EmptyState, StatsCard } from "../components/Card";
import { InvoiceSummary } from "../components/InvoiceSummary";
import { styles } from "../styles/styles";
import { money } from "../utils/currency";
import {
  getAvailableUploadMonths,
  getMonthLabel,
  getSpentForUploadMonth,
  getTotalSpent,
} from "../utils/invoices";

export function DashboardScreen({ app, t }) {
  const processed = app.invoices.filter((record) => record.invoice);
  const recent = app.invoices.slice(0, 3);
  const total = getTotalSpent(processed);
  const uploadMonths = useMemo(() => getAvailableUploadMonths(app.invoices), [app.invoices]);
  const currentMonth = getCurrentMonth();
  const selectableMonths = uploadMonths.filter((month) => month !== currentMonth);
  const [selectedMonth, setSelectedMonth] = useState(selectableMonths[0] || uploadMonths[0] || currentMonth);
  const currentSpend = getSpentForUploadMonth(processed, currentMonth);
  const selectedSpend = getSpentForUploadMonth(processed, selectedMonth);

  return (
    <>
      <StatsCard items={[
        [t("totalSpend"), money(total)],
        [t("invoices"), String(app.invoices.length)],
        [t("pending"), String(app.invoices.filter((record) => !record.invoice).length)],
      ]} />
      <Card>
        <Text style={styles.sectionTitle}>{t("monthlyBudget")}</Text>
        <Text style={styles.helperText}>{t("monthlyBudgetCopy")}</Text>
        <View style={styles.inlineStats}>
          {[
            [t("thisMonth"), money(currentSpend)],
            [selectedMonth ? getMonthLabel(selectedMonth) : t("selectMonth"), money(selectedSpend)],
          ].map(([label, value]) => (
            <View key={label} style={styles.stat}>
              <Text numberOfLines={2} style={styles.statLabel}>{label}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>{value}</Text>
            </View>
          ))}
        </View>
        <View style={styles.chipGrid}>
          {selectableMonths.length ? selectableMonths.map((month) => (
            <Pressable
              key={month}
              onPress={() => setSelectedMonth(month)}
              style={({ pressed }) => [
                styles.categoryChip,
                selectedMonth === month && styles.categoryChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.categoryChipText, selectedMonth === month && styles.categoryChipTextActive]}>
                {getMonthLabel(month)}
              </Text>
            </Pressable>
          )) : (
            <Text style={styles.statusText}>{t("noPastMonths")}</Text>
          )}
        </View>
      </Card>
      <Card>
        <Text style={styles.sectionTitle}>{t("recentInvoices")}</Text>
        {recent.length ? recent.map((record) => (
          <InvoiceSummary key={record.invoice_file_id} record={record} t={t} />
        )) : <EmptyState title={t("noInvoicesYet")} copy={t("firstInvoice")} />}
      </Card>
    </>
  );
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
