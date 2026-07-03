import { Pressable, Text, View } from "react-native";

import { languages } from "../i18n";
import { styles } from "../styles/styles";

export function Header({ title, user, language, updateLanguage, onLogout, t }) {
  const isGuest = user?.is_guest;

  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.userEmail}>{isGuest ? t("guestUser") : user?.email}</Text>
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
        {!isGuest && user?.email && (
          <Pressable onPress={onLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>{t("logout")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
