import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { DEFAULT_CURRENCY } from "../constants";
import { styles } from "../styles/styles";
import { categories } from "../utils/categories";
import { parseMoney } from "../utils/currency";
import { PrimaryButton } from "./Card";

function emptyItem() {
  return {
    item_name: "",
    quantity: "1",
    unit_price: "",
    total_price: "",
    category: "other",
  };
}

export function ManualInvoiceForm({ onSave, t }) {
  const [supplierName, setSupplierName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState("other");
  const [items, setItems] = useState([emptyItem()]);
  const [error, setError] = useState("");

  const total = useMemo(
    () => items.reduce((sum, item) => sum + getItemTotal(item), 0),
    [items],
  );

  function updateItem(index, patch) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  function addItem() {
    setItems((current) => [...current, { ...emptyItem(), category: categoryId }]);
  }

  function removeItem(index) {
    setItems((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)));
  }

  function save() {
    const cleanItems = items
      .map((item) => ({
        ...item,
        item_name: item.item_name.trim(),
        category: item.category || categoryId,
        total_price: String(getItemTotal(item).toFixed(2)),
      }))
      .filter((item) => item.item_name || parseMoney(item.total_price) > 0);

    if (!supplierName.trim()) {
      setError(t("supplierRequired"));
      return;
    }

    if (!cleanItems.length) {
      setError(t("itemRequired"));
      return;
    }

    setError("");
    onSave({
      supplier_name: supplierName.trim(),
      invoice_number: "",
      invoice_date: invoiceDate || null,
      currency: DEFAULT_CURRENCY,
      subtotal: String(total.toFixed(2)),
      tax_amount: "0.00",
      total_amount: String(total.toFixed(2)),
      items: cleanItems,
    }, categoryId);

    setSupplierName("");
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setCategoryId("other");
    setItems([emptyItem()]);
  }

  return (
    <View style={styles.manualForm}>
      <View style={styles.field}>
        <Text style={styles.label}>{t("supplier")}</Text>
        <TextInput value={supplierName} onChangeText={setSupplierName} style={styles.input} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t("invoiceDate")}</Text>
        <TextInput value={invoiceDate} onChangeText={setInvoiceDate} placeholder="YYYY-MM-DD" style={styles.input} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t("category")}</Text>
        <View style={styles.chipGrid}>
          {categories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setCategoryId(category.id)}
              style={({ pressed }) => [
                styles.categoryChip,
                categoryId === category.id && styles.categoryChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.categoryChipText, categoryId === category.id && styles.categoryChipTextActive]}>
                {t(category.id)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {items.map((item, index) => (
        <View key={index} style={styles.manualItem}>
          <View style={styles.manualItemHeader}>
            <Text style={styles.selectedName}>{t("item")} {index + 1}</Text>
            {items.length > 1 && (
              <Pressable onPress={() => removeItem(index)} style={styles.smallButton}>
                <Text style={styles.smallButtonText}>{t("remove")}</Text>
              </Pressable>
            )}
          </View>
          <TextInput
            value={item.item_name}
            onChangeText={(value) => updateItem(index, { item_name: value })}
            placeholder={t("productName")}
            style={styles.input}
          />
          <View style={styles.twoColumn}>
            <TextInput
              value={item.quantity}
              onChangeText={(value) => updateItem(index, { quantity: value })}
              keyboardType="decimal-pad"
              placeholder={t("quantity")}
              style={[styles.input, styles.flexInput]}
            />
            <TextInput
              value={item.unit_price}
              onChangeText={(value) => updateItem(index, { unit_price: value })}
              keyboardType="decimal-pad"
              placeholder={t("unitPrice")}
              style={[styles.input, styles.flexInput]}
            />
          </View>
          <TextInput
            value={item.total_price}
            onChangeText={(value) => updateItem(index, { total_price: value })}
            keyboardType="decimal-pad"
            placeholder={t("lineTotal")}
            style={styles.input}
          />
        </View>
      ))}

      <Pressable onPress={addItem} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>{t("addItem")}</Text>
      </Pressable>

      <Text style={styles.statusText}>{t("manualTotal", { amount: total.toFixed(2) })}</Text>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
      <PrimaryButton title={t("saveManualInvoice")} onPress={save} />
    </View>
  );
}

function getItemTotal(item) {
  const explicitTotal = parseMoney(item.total_price);
  if (explicitTotal > 0) {
    return explicitTotal;
  }

  return parseMoney(item.quantity || 1) * parseMoney(item.unit_price);
}
