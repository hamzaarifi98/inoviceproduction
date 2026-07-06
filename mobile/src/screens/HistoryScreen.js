import { useState } from "react";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert, Modal, Pressable, Share, Text, View } from "react-native";

import {
  invoiceCategoryCsvRows,
  invoiceItemsCsvRows,
  invoiceSummaryCsvRows,
  pollForResult,
} from "../api/invoices";
import { ActionTile, Card, EmptyState, PrimaryButton, StatsCard } from "../components/Card";
import { ExpandableInvoice } from "../components/InvoiceSummary";
import { DEFAULT_CURRENCY } from "../constants";
import { styles } from "../styles/styles";
import { detectCategory } from "../utils/categories";
import { money } from "../utils/currency";
import { getInvoiceAmount, getTotalSpent } from "../utils/invoices";

const EXPORT_OPTIONS = [
  { key: "summary", titleKey: "exportSummaryOption", copyKey: "exportSummaryOptionCopy", build: invoiceSummaryCsvRows },
  { key: "items", titleKey: "exportItemsOption", copyKey: "exportItemsOptionCopy", build: invoiceItemsCsvRows },
  { key: "category", titleKey: "exportCategoryOption", copyKey: "exportCategoryOptionCopy", build: invoiceCategoryCsvRows },
];

export function HistoryScreen({ app, t }) {
  const [openInvoiceId, setOpenInvoiceId] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const [isExportPickerOpen, setIsExportPickerOpen] = useState(false);
  const invoices = app.invoices;
  const processed = invoices.filter((record) => record.invoice);

  function openExportPicker() {
    if (!processed.length) {
      Alert.alert(t("exportInvoices"), t("nothingToExport"));
      return;
    }

    setIsExportPickerOpen(true);
  }

  async function exportInvoices(buildCsvRows) {
    setIsExportPickerOpen(false);

    const csv = buildCsvRows(processed);
    const file = new File(Paths.cache, `ai-fiskalna-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`);

    try {
      file.create({ overwrite: true });
      file.write(`\uFEFF${csv}`, { encoding: "utf8" });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          dialogTitle: t("exportInvoices"),
          mimeType: "text/csv",
          UTI: "public.comma-separated-values-text",
        });
        return;
      }

      await Share.share({
        title: t("exportInvoices"),
        message: csv,
        url: file.uri,
      });
    } catch (caught) {
      Alert.alert(t("exportInvoices"), caught.message);
    }
  }

  async function retryInvoice(record) {
    if (record.source === "manual") {
      Alert.alert(t("retryFailed"), t("manualRetryUnavailable"));
      return;
    }

    setRetryingId(record.invoice_file_id);

    try {
      await app.request(`/invoices/files/${record.invoice_file_id}/retry`, { method: "POST" });
      app.updateInvoice(record.invoice_file_id, {
        status: "processing",
        error_message: null,
      });

      const result = await pollForResult(app.request, record.invoice_file_id, () => {});

      if (result.invoice) {
        app.updateInvoice(record.invoice_file_id, {
          status: result.status,
          invoice: result.invoice,
          category: detectCategory(result.invoice),
          amount: getInvoiceAmount({ invoice: result.invoice }),
          currency: result.invoice.currency || DEFAULT_CURRENCY,
          error_message: null,
        });
        Alert.alert(t("complete"), result.invoice.supplier_name || t("invoice"));
      } else {
        app.updateInvoice(record.invoice_file_id, {
          status: result.status,
          error_message: result.error_message || null,
        });
      }
    } catch (caught) {
      Alert.alert(t("retryFailed"), caught.message);
    } finally {
      setRetryingId(null);
    }
  }

  function confirmDeleteInvoice(record) {
    const title = record.invoice?.supplier_name || record.original_filename || t("invoice");

    Alert.alert(
      t("deleteInvoice"),
      t("deleteInvoiceConfirm", { title }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await app.deleteInvoice(record.invoice_file_id, { source: record.source });

              if (openInvoiceId === record.invoice_file_id) {
                setOpenInvoiceId(null);
              }
            } catch (caught) {
              Alert.alert(t("deleteInvoice"), caught.message);
            }
          },
        },
      ],
    );
  }

  return (
    <>
      <StatsCard items={[
        [t("totalSpend"), money(getTotalSpent(processed))],
        [t("processed"), String(processed.length)],
        [t("allInvoices"), String(invoices.length)],
      ]} />
      <Card>
        <View style={styles.actionRow}>
          <Text style={styles.sectionTitle}>{t("exportInvoices")}</Text>
          <Text style={styles.helperText}>{t("exportCopy")}</Text>
        </View>
        <PrimaryButton title={t("exportCsv")} disabled={!processed.length} onPress={openExportPicker} />
      </Card>
      <Card>
        {invoices.length ? invoices.map((record) => (
          <ExpandableInvoice
            key={record.invoice_file_id}
            record={record}
            isOpen={openInvoiceId === record.invoice_file_id}
            onToggle={() => setOpenInvoiceId(openInvoiceId === record.invoice_file_id ? null : record.invoice_file_id)}
            onRetry={() => retryInvoice(record)}
            onDelete={() => confirmDeleteInvoice(record)}
            isRetrying={retryingId === record.invoice_file_id}
            t={t}
          />
        )) : <EmptyState title={t("historyEmpty")} copy={t("historyCopy")} />}
      </Card>

      <Modal visible={isExportPickerOpen} transparent animationType="fade" onRequestClose={() => setIsExportPickerOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setIsExportPickerOpen(false)}>
          <Pressable style={[styles.card, styles.exportModalCard]} onPress={() => {}}>
            <View style={styles.actionRow}>
              <Text style={styles.sectionTitle}>{t("exportInvoices")}</Text>
              <Text style={styles.helperText}>{t("exportOptionsCopy")}</Text>
            </View>
            {EXPORT_OPTIONS.map((option) => (
              <ActionTile
                key={option.key}
                title={t(option.titleKey)}
                copy={t(option.copyKey)}
                onPress={() => exportInvoices(option.build)}
              />
            ))}
            <Pressable
              onPress={() => setIsExportPickerOpen(false)}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>{t("cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
