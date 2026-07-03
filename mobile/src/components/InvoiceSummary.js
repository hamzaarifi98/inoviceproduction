import { Pressable, Text, View } from "react-native";

import { styles } from "../styles/styles";
import { money } from "../utils/currency";
import { formatItemMeta, getInvoiceAmount, getInvoiceCurrency } from "../utils/invoices";
import { EmptyState, PrimaryButton } from "./Card";

export function InvoiceSummary({ record, t }) {
  const amount = record.invoice ? money(getInvoiceAmount(record), getInvoiceCurrency(record)) : t("extractingShort");

  return (
    <View style={styles.invoiceSummary}>
      <View style={styles.invoiceText}>
        <Text style={styles.invoiceTitle}>{record.invoice?.supplier_name || record.original_filename || t("invoice")}</Text>
        <Text style={styles.invoiceMeta}>{record.invoice ? t(record.category?.id || "other") : record.status}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.invoiceAmount}>{amount}</Text>
    </View>
  );
}

export function ExpandableInvoice({ record, isOpen, onToggle, onRetry, onDelete, isRetrying, t }) {
  const invoice = record.invoice || {};
  const category = record.category?.id ? t(record.category.id) : t("unsorted");
  const amount = record.invoice ? money(getInvoiceAmount(record), getInvoiceCurrency(record)) : t("extractingShort");
  const items = invoice.items || [];
  const canRetry = record.status === "failed" && onRetry;

  return (
    <View style={styles.invoiceCard}>
      <Pressable
        onLongPress={onDelete}
        onPress={() => record.invoice && onToggle()}
        delayLongPress={450}
        style={({ pressed }) => [styles.invoiceSummary, pressed && styles.pressed]}
      >
        <View style={styles.invoiceText}>
          <Text style={styles.invoiceTitle}>{invoice.supplier_name || record.original_filename || t("invoice")}</Text>
          <Text style={styles.invoiceMeta}>{category} · {record.status}</Text>
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.invoiceAmount}>{amount}</Text>
      </Pressable>

      {isOpen && (
        <View style={styles.itemList}>
          {items.length ? items.map((item, index) => (
            <View key={`${item.item_name}-${index}`} style={styles.itemRow}>
              <View style={styles.invoiceText}>
                <Text style={styles.itemName}>{item.item_name || t("item")}</Text>
                <Text style={styles.invoiceMeta}>{formatItemMeta(item)}</Text>
              </View>
              <Text style={styles.itemPrice}>{money(item.total_price, getInvoiceCurrency(record))}</Text>
            </View>
          )) : <EmptyState title={t("noItems")} copy={t("noItemsCopy")} />}
        </View>
      )}

      {canRetry && (
        <View style={styles.retryPanel}>
          <Text style={styles.errorText}>{record.error_message || t("failedInvoice")}</Text>
          <PrimaryButton title={t("retryFailed")} busy={isRetrying} onPress={onRetry} />
        </View>
      )}
    </View>
  );
}
