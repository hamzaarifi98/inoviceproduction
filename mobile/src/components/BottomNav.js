import { Pressable, Text, View } from "react-native";

import { tabs } from "../constants";
import { styles } from "../styles/styles";

export function BottomNav({ route, setRoute, t }) {
  return (
    <View style={styles.nav}>
      {tabs.map(([id, labelKey]) => (
        <Pressable
          key={id}
          onPress={() => setRoute(id)}
          style={({ pressed }) => [
            styles.navButton,
            route === id && styles.navButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.navText, route === id && styles.navTextActive]}
          >
            {t(labelKey)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
