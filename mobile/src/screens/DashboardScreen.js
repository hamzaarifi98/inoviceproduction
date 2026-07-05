import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Card, EmptyState } from "../components/Card";
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
  const invoicesCount = app.invoices.length;
  const pendingCount = app.invoices.filter((record) => !record.invoice).length;

  const uploadMonths = useMemo(
    () => getAvailableUploadMonths(app.invoices),
    [app.invoices]
  );

  const currentMonth = getCurrentMonth();
  const selectableMonths = uploadMonths.filter((month) => month !== currentMonth);

  const [selectedMonth, setSelectedMonth] = useState(
    selectableMonths[0] || uploadMonths[0] || currentMonth
  );

  const currentSpend = getSpentForUploadMonth(processed, currentMonth);
  const selectedSpend = getSpentForUploadMonth(processed, selectedMonth);

  const maxSpend = Math.max(currentSpend, selectedSpend, 1);
  const currentPercent = `${Math.min((currentSpend / maxSpend) * 100, 100)}%`;
  const selectedPercent = `${Math.min((selectedSpend / maxSpend) * 100, 100)}%`;

  return (
    <>
      <View style={styles.dashboardStatsGrid}>
        <View style={styles.dashboardStatCardLarge}>
          <Text style={styles.dashboardStatLabel}>{t("totalSpend")}</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={styles.dashboardStatAmount}
          >
            {money(total)}
          </Text>
        </View>

        <View style={styles.dashboardStatSide}>
          <View style={styles.dashboardMiniStatCard}>
            <Text style={styles.dashboardStatLabel}>{t("invoices")}</Text>
            <Text style={styles.dashboardMiniStatValue}>{invoicesCount}</Text>
          </View>

          <View style={styles.dashboardMiniStatCard}>
            <Text style={styles.dashboardStatLabel}>{t("pending")}</Text>
            <Text style={styles.dashboardMiniStatValue}>{pendingCount}</Text>
          </View>
        </View>
      </View>

      <View style={styles.monthlyCard}>
        <View style={styles.monthlyHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.monthlyTitle}>{t("monthlyBudget")}</Text>
            <Text style={styles.monthlySubtitle}>{t("monthlyBudgetCopy")}</Text>
          </View>

          <View style={styles.monthlyIconBubble}>
            <Text style={styles.monthlyIconText}>↗</Text>
          </View>
        </View>

        <View style={styles.monthlyCompareRow}>
          <View style={styles.monthlyCompareItem}>
            <Text style={styles.monthlyLabel}>{t("thisMonth")}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.monthlyMoney}>
              {money(currentSpend)}
            </Text>

            <View style={styles.monthlyBarTrack}>
              <View style={[styles.monthlyBarFill, { width: currentPercent }]} />
            </View>
          </View>

          <View style={styles.monthlyCompareItem}>
            <Text style={styles.monthlyLabel}>
              {selectedMonth ? getMonthLabel(selectedMonth) : t("selectMonth")}
            </Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.monthlyMoney}>
              {money(selectedSpend)}
            </Text>

            <View style={styles.monthlyBarTrack}>
              <View style={[styles.monthlyBarFillSoft, { width: selectedPercent }]} />
            </View>
          </View>
        </View>

        {selectableMonths.length ? (
          <View style={styles.monthChipsWrap}>
            {selectableMonths.map((month) => (
              <Pressable
                key={month}
                onPress={() => setSelectedMonth(month)}
                style={({ pressed }) => [
                  styles.monthChip,
                  selectedMonth === month && styles.monthChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.monthChipText,
                    selectedMonth === month && styles.monthChipTextActive,
                  ]}
                >
                  {getMonthLabel(month)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyMonthBox}>
            <Text style={styles.emptyMonthText}>{t("noPastMonths")}</Text>
          </View>
        )}
      </View>

      <View style={styles.recentInvoicesCard}>
        <View style={styles.recentInvoicesHeader}>
          <Text style={styles.recentInvoicesTitle}>{t("recentInvoices")}</Text>
          {recent.length ? (
            <Text style={styles.recentInvoicesCount}>{recent.length}</Text>
          ) : null}
        </View>

        {recent.length ? (
          recent.map((record) => (
            <InvoiceSummary
              key={record.invoice_file_id}
              record={record}
              t={t}
            />
          ))
        ) : (
          <EmptyState title={t("noInvoicesYet")} copy={t("firstInvoice")} />
        )}
      </View>
    </>
  );
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}