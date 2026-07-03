import { Pressable, Text, View } from "react-native";

import { styles } from "../styles/styles";
import { money } from "../utils/currency";

export function CategoryRow({ summary, max, isSelected, onPress, t }) {
  const width = `${Math.max((summary.amount / max) * 100, summary.amount ? 8 : 0)}%`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.categoryRow,
        isSelected && styles.categoryRowSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.categoryMeta}>
        <View style={[styles.categoryDot, { backgroundColor: summary.color }]} />
        <Text style={styles.categoryName}>{t(summary.id)}</Text>
        <Text style={styles.categoryCount}>{t("itemCount", { count: summary.count })}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.categoryAmount}>{money(summary.amount)}</Text>
      </View>
      <View style={styles.categoryBar}>
        <View style={[styles.categoryFill, { width, backgroundColor: summary.color }]} />
      </View>
    </Pressable>
  );
}
