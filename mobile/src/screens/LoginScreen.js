import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "../components/Card";
import { languages, translate } from "../i18n";
import { styles } from "../styles/styles";

export function LoginScreen({ app, onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationPin, setVerificationPin] = useState("");
  const [apiUrl, setApiUrl] = useState(app.apiUrl);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = (key, params) => translate(app.language, key, params);

  async function submit() {
    if (!email || (mode !== "verify" && !password)) {
      setError(t("enterEmailPassword"));
      return;
    }

    if (mode === "verify" && !verificationPin) {
      setError(t("enterVerificationPin"));
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await app.updateApiUrl(apiUrl);
      if (mode === "register") {
        await app.request("/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setMode("verify");
        setError(t("verificationPinSent"));
        return;
      }

      const session = await app.request(mode === "verify" ? "/auth/verify-email" : "/auth/login", {
        method: "POST",
        body: JSON.stringify(mode === "verify" ? { email, pin: verificationPin } : { email, password }),
      });

      await app.saveSession({
        token: session.access_token,
        user: session.user,
      });
      onAuthenticated?.();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.authScreen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.authPanel}>
        <View style={styles.brandMark}>
          <Text style={styles.brandText}>IP</Text>
        </View>
        <View style={styles.authTitleRow}>
          <View style={styles.authTitleText}>
            <Text style={styles.authTitle}>{t("appName")}</Text>
            <Text style={styles.authCopy}>{t("appCopy")}</Text>
          </View>
          <View style={styles.languageSwitch} accessibilityLabel={t("language")}>
            {languages.map((item) => (
              <Pressable
                key={item.code}
                onPress={() => app.updateLanguage(item.code)}
                style={[styles.languageButton, app.language === item.code && styles.languageButtonActive]}
              >
                <Text style={[styles.languageText, app.language === item.code && styles.languageTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t("apiServer")}</Text>
          <TextInput value={apiUrl} onChangeText={setApiUrl} autoCapitalize="none" style={styles.input} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t("email")}</Text>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
        </View>

        {mode !== "verify" && (
          <View style={styles.field}>
            <Text style={styles.label}>{t("password")}</Text>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
          </View>
        )}

        {mode === "verify" && (
          <View style={styles.field}>
            <Text style={styles.label}>{t("verificationPin")}</Text>
            <TextInput
              value={verificationPin}
              onChangeText={setVerificationPin}
              keyboardType="number-pad"
              maxLength={6}
              style={styles.input}
            />
          </View>
        )}

        <PrimaryButton
          title={mode === "login" ? t("login") : mode === "verify" ? t("verifyEmail") : t("createAccount")}
          busy={isSubmitting}
          onPress={submit}
        />
        <Pressable
          onPress={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>{mode === "login" ? t("createNewAccount") : t("alreadyHaveAccount")}</Text>
        </Pressable>
        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
