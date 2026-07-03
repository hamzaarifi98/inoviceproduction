import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { styles } from "../styles/styles";

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({ title, busy, onPress, disabled }) {
  return (
    <Pressable
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && styles.primaryPressed,
        (busy || disabled) && styles.disabled,
      ]}
    >
      {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>{title}</Text>}
    </Pressable>
  );
}

export function ActionTile({ title, copy, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionTile, pressed && styles.pressed]}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionCopy}>{copy}</Text>
    </Pressable>
  );
}

export function EmptyState({ title, copy }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </View>
  );
}

export function StatsCard({ items }) {
  return (
    <Card style={styles.statsCard}>
      {items.map(([label, value]) => (
        <View key={label} style={styles.stat}>
          <Text numberOfLines={2} style={styles.statLabel}>{label}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>{value}</Text>
        </View>
      ))}
    </Card>
  );
}
