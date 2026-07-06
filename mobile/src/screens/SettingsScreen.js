import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { Card, PrimaryButton } from "../components/Card";
import { APP_VERSION, SUPPORT_EMAIL } from "../constants";
import { languages } from "../i18n";
import { styles } from "../styles/styles";

export function SettingsScreen({ app, t, onLogin }) {
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [message, setMessage] = useState("");
  const user = app.session.user;
  const isGuest = Boolean(user?.is_guest);
  const isPro = Boolean(app.scanUsage?.is_pro || user?.is_pro);
  const usedScans = app.scanUsage?.used_scans ?? app.invoices.length;
  const freeScanLimit = app.scanUsage?.free_scan_limit ?? 5;
  const remainingScans = app.scanUsage?.remaining_free_scans ?? Math.max(freeScanLimit - usedScans, 0);

  function contactSupport() {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t("helpSupport"))}`);
  }

  function sendFeedback() {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t("sendFeedback"))}`);
  }

  async function subscribeToPro() {
    if (isGuest) {
      onLogin?.();
      return;
    }

    setIsSubscribing(true);
    setMessage("");

    try {
      await app.activatePro?.();
      setMessage(t("proActivated"));
    } catch (caught) {
      setMessage(caught.message);
    } finally {
      setIsSubscribing(false);
    }
  }

  return (
    <>
      <View style={styles.settingsHero}>
        <View style={styles.settingsHeroTop}>
          <View style={styles.settingsHeroText}>
            <Text style={styles.settingsHeroTitle}>{t("settings")}</Text>
            <Text style={styles.settingsHeroCopy}>{t("settingsCopy")}</Text>
          </View>
          <Text style={[styles.settingsPlanBadge, isPro && styles.settingsPlanBadgePro]}>
            {isPro ? "PRO" : t("freePlan")}
          </Text>
        </View>

        <View style={styles.settingsMetricGrid}>
          <View style={styles.settingsMetric}>
            <Text style={styles.settingsMetricLabel}>{t("currentPlan")}</Text>
            <Text style={styles.settingsMetricValue}>{isPro ? t("proActive") : t("freePlan")}</Text>
          </View>
          <View style={styles.settingsMetric}>
            <Text style={styles.settingsMetricLabel}>{t("scans")}</Text>
            <Text style={styles.settingsMetricValue}>
              {isPro ? t("unlimited") : `${Math.min(usedScans, freeScanLimit)}/${freeScanLimit}`}
            </Text>
          </View>
        </View>
      </View>

      <Card>
        <SettingsSectionTitle title={t("account")} copy={isGuest ? t("guestAccountCopy") : t("accountReadyCopy")} />
        <SettingsRow label={t("email")} value={isGuest ? t("guestUser") : user?.email || t("guestUser")} />
        <SettingsRow label={t("accountStatus")} value={isGuest ? t("guestAccount") : t("signedIn")} />
        {isGuest && <PrimaryButton title={t("logInToSubscribe")} onPress={onLogin} />}
      </Card>

      <Card style={styles.billingCard}>
        <SettingsSectionTitle title={t("billing")} copy={isPro ? t("proActiveCopy") : t("proBillingCopy")} />
        {!isPro && (
          <View style={styles.priceRow}>
            <Text style={styles.priceAmount}>2.99</Text>
            <Text style={styles.pricePeriod}>{t("perMonth")}</Text>
          </View>
        )}
        <FeatureRow text={t("proFeatureUnlimited")} />
        <FeatureRow text={t("proFeatureHistory")} />
        <FeatureRow text={t("proFeatureExport")} />

        {!isPro && (
          <PrimaryButton
            title={isGuest ? t("logInToSubscribe") : t("subscribeProPrice")}
            busy={isSubscribing}
            onPress={subscribeToPro}
          />
        )}
        {!!message && <Text style={[styles.settingsMessage, !isPro && styles.errorText]}>{message}</Text>}
      </Card>

      <Card>
        <SettingsSectionTitle title={t("preferences")} copy={t("preferencesCopy")} />
        <View style={styles.settingsLanguageSwitch} accessibilityLabel={t("language")}>
          {languages.map((item) => (
            <Pressable
              key={item.code}
              onPress={() => app.updateLanguage(item.code)}
              style={[
                styles.settingsLanguageButton,
                app.language === item.code && styles.settingsLanguageButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.settingsLanguageText,
                  app.language === item.code && styles.settingsLanguageTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <SettingsSectionTitle title={t("usage")} copy={t("usageCopy")} />
        <SettingsRow label={t("scansUsedLabel")} value={String(usedScans)} />
        <SettingsRow label={t("freeScansLeftLabel")} value={isPro ? t("unlimited") : String(remainingScans)} />
        <SettingsRow label={t("invoicesStored")} value={String(app.invoices.length)} />
      </Card>

      <Card>
        <SettingsSectionTitle title={t("helpSupport")} copy={t("helpSupportCopy")} />
        <Pressable onPress={contactSupport} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>{t("contactSupport")}</Text>
        </Pressable>
        <SettingsSectionTitle title={t("sendFeedback")} copy={t("feedbackCopy")} />
        <Pressable onPress={sendFeedback} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>{t("sendFeedback")}</Text>
        </Pressable>
      </Card>

      <Card>
        <SettingsSectionTitle title={t("aboutApp")} copy={t("aboutAppCopy")} />
        <SettingsRow label={t("appVersionLabel")} value={APP_VERSION} />
      </Card>
    </>
  );
}

function SettingsSectionTitle({ title, copy }) {
  return (
    <View style={styles.settingsSectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.helperText}>{copy}</Text>
    </View>
  );
}

function SettingsRow({ label, value }) {
  return (
    <View style={styles.settingsRow}>
      <Text style={styles.settingsLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.settingsValue}>
        {value}
      </Text>
    </View>
  );
}

function FeatureRow({ text }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureCheck}>+</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}
