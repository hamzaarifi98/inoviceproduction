import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Pressable, ScrollView, Text } from "react-native";

import { styles } from "../styles/styles";
import { SettingsScreen } from "../screens/SettingsScreen";

const MAX_PHONE_WIDTH = 430;
const DRAWER_WIDTH_RATIO = 0.8;

export function SettingsDrawer({ visible, onClose, onLogin, onLogout, app, t }) {
  const isGuest = Boolean(app.session.user?.is_guest);
  const windowWidth = Dimensions.get("window").width;
  const panelWidth = Math.min(windowWidth, MAX_PHONE_WIDTH) * DRAWER_WIDTH_RATIO;
  const translateX = useRef(new Animated.Value(-panelWidth)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [isMounted, setIsMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
    }

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: visible ? 0 : -panelWidth,
        duration: visible ? 260 : 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? 260 : 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && !visible) {
        setIsMounted(false);
      }
    });
  }, [visible, panelWidth]);

  if (!isMounted) {
    return null;
  }

  return (
    <Animated.View
      style={styles.settingsOverlay}
      pointerEvents={visible ? "auto" : "none"}
    >
      <Animated.View style={[styles.settingsBackdrop, { opacity: backdropOpacity }]}>
        <Pressable style={styles.settingsBackdropPress} onPress={onClose} accessibilityLabel={t("cancel")} />
      </Animated.View>

      <Animated.View style={[styles.settingsPanel, { width: panelWidth, transform: [{ translateX }] }]}>
        <ScrollView contentContainerStyle={styles.settingsPanelContent}>
          <SettingsScreen app={app} t={t} onLogin={onLogin} />
        </ScrollView>

        {!isGuest && (
          <Pressable
            onPress={onLogout}
            style={({ pressed }) => [styles.settingsLogoutButton, pressed && styles.pressed]}
          >
            <Text style={styles.settingsLogoutText}>{t("logout")}</Text>
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
}
