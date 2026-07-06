import { Pressable, Text, View } from "react-native";

import { languages } from "../i18n";
import { styles } from "../styles/styles";

export function Header({
  title,
  user,
  language,
  updateLanguage,
  onOpenSettings,
  isSettingsOpen,
  t,
}) {
  const isGuest = user?.is_guest;
  const displayName = isGuest ? t("guestUser") : user?.email || t("guestUser");
  const initial = (displayName.trim()[0] || "?").toUpperCase();

  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <View style={styles.userChip}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{initial}</Text>
          </View>
          <Text style={styles.userEmail} numberOfLines={1} ellipsizeMode="tail">
            {displayName}
          </Text>
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.headerActions}>
        <View style={styles.languageSwitch} accessibilityLabel={t("language")}>
          {languages.map((item) => (
            <Pressable
              key={item.code}
              onPress={() => updateLanguage(item.code)}
              style={[styles.languageButton, language === item.code && styles.languageButtonActive]}
            >
              <Text style={[styles.languageText, language === item.code && styles.languageTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={onOpenSettings}
          accessibilityLabel={t("settings")}
          style={[
            styles.settingsButton,
            isSettingsOpen && styles.settingsButtonActive,
          ]}
        >
          <Text
            style={[
              styles.settingsIcon,
              isSettingsOpen && styles.settingsIconActive,
            ]}
          >
            ⚙
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
