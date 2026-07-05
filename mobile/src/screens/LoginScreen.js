import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Image,
  Keyboard,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { PrimaryButton } from "../components/Card";
import { languages, translate } from "../i18n";
import { styles } from "../styles/styles";

export function LoginScreen({ app, onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationPin, setVerificationPin] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const t = (key, params) => translate(app.language, key, params);
  const needsPin = mode === "verify" || mode === "reset";
  const needsPassword =
    mode === "login" || mode === "register" || mode === "reset";

  async function submit() {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError(mode === "forgot" ? t("enterEmailForReset") : t("enterEmailPassword"));
      return;
    }

    if (needsPassword && !password) {
      setError(t("enterEmailPassword"));
      return;
    }

    if (needsPin && !verificationPin) {
      setError(t("enterVerificationPin"));
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      if (mode === "register") {
        const response = await app.request("/auth/register", {
          method: "POST",
          body: JSON.stringify({ email: cleanEmail, password }),
          timeoutMs: 45000,
          timeoutMessage:
            "Registration took too long. The server may still be waking up; please try again.",
        });

        setVerificationPin("");
        setMode("verify");
        setError(
          response.email_sent === false
            ? t("verificationPinConsole")
            : t("verificationPinSent")
        );
        return;
      }

      if (mode === "forgot") {
        await app.request("/auth/request-password-reset", {
          method: "POST",
          body: JSON.stringify({ email: cleanEmail }),
          timeoutMs: 45000,
          timeoutMessage:
            "Password reset took too long. The server may still be waking up; please try again.",
        });

        setPassword("");
        setVerificationPin("");
        setMode("reset");
        setError(t("passwordResetPinSent"));
        return;
      }

      const session = await app.request(
        mode === "verify"
          ? "/auth/verify-email"
          : mode === "reset"
          ? "/auth/reset-password"
          : "/auth/login",
        {
          method: "POST",
          body: JSON.stringify(
            mode === "verify"
              ? { email: cleanEmail, pin: verificationPin }
              : mode === "reset"
              ? { email: cleanEmail, pin: verificationPin, password }
              : { email: cleanEmail, password }
          ),
          timeoutMs: 45000,
          timeoutMessage:
            "Login took too long. The server may still be waking up; please try again.",
        }
      );

      await app.saveSession({
        token: session.access_token,
        user: session.user,
      });

      onAuthenticated?.();
    } catch (caught) {
      if (mode === "login" && caught.status === 403) {
        setVerificationPin("");
        setMode("verify");
        setError(t("emailNotVerified"));
      } else {
        setError(caught.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendVerification() {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError(t("enterEmailPassword"));
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await app.request("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: cleanEmail }),
        timeoutMs: 45000,
        timeoutMessage:
          "Verification took too long. The server may still be waking up; please try again.",
      });
      setError(
        response.email_sent === false
          ? t("verificationPinConsole")
          : t("verificationPinResent")
      );
    } catch (caught) {
      setError(caught.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function switchMode(nextMode) {
    if (nextMode === "forgot" || nextMode === "reset" || mode === "reset") {
      setPassword("");
    }
    setMode(nextMode);
    setError("");
    setVerificationPin("");
  }

  function getPrimaryTitle() {
    if (mode === "login") {
      return t("login");
    }
    if (mode === "verify") {
      return t("verifyEmail");
    }
    if (mode === "forgot") {
      return t("requestResetPin");
    }
    if (mode === "reset") {
      return t("resetPassword");
    }
    return t("createAccount");
  }

  return (
    <SafeAreaView style={styles.authScreen}>
      <StatusBar style="dark" />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.authScrollContent}
          enableOnAndroid={true}
          extraScrollHeight={80}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authPanel}>
            <View style={styles.brandMark}>
              <Image
                source={require("../../assets/icon.png")}
                style={styles.brandImage}
              />
            </View>

            <View style={styles.authTitleRow}>
              <View style={styles.authTitleText}>
                <Text style={styles.authTitle}>{t("appName")}</Text>
                <Text style={styles.authCopy}>{t("appCopy")}</Text>
              </View>
              <View
                style={styles.authLanguageSwitch}
                accessibilityLabel={t("language")}
              >
                {languages.map((item) => (
                  <Pressable
                    key={item.code}
                    onPress={() => app.updateLanguage(item.code)}
                    style={[
                      styles.authLanguageButton,
                      app.language === item.code && styles.authLanguageButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.authLanguageText,
                        app.language === item.code && styles.authLanguageTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t("email")}</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                style={styles.input}
              />
            </View>

            {needsPassword && (
              <View style={styles.field}>
                <Text style={styles.label}>
                  {mode === "reset" ? t("newPassword") : t("password")}
                </Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete={mode === "reset" ? "new-password" : "password"}
                  textContentType={mode === "reset" ? "newPassword" : "password"}
                  style={styles.input}
                />
              </View>
            )}

            {needsPin && (
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
              title={getPrimaryTitle()}
              busy={isSubmitting}
              onPress={submit}
            />

            <View style={styles.authLinks}>
              {mode === "login" && (
                <Pressable
                  onPress={() => switchMode("forgot")}
                  style={styles.linkButton}
                >
                  <Text style={styles.linkText}>{t("forgotPassword")}</Text>
                </Pressable>
              )}

              {mode === "verify" && (
                <Pressable
                  disabled={isSubmitting}
                  onPress={resendVerification}
                  style={styles.linkButton}
                >
                  <Text style={styles.linkText}>{t("resendVerification")}</Text>
                </Pressable>
              )}

              <Pressable
                onPress={() =>
                  switchMode(mode === "login" ? "register" : "login")
                }
                style={styles.linkButton}
              >
                <Text style={styles.linkText}>
                  {mode === "login"
                    ? t("createNewAccount")
                    : mode === "forgot" || mode === "reset"
                    ? t("backToLogin")
                    : t("alreadyHaveAccount")}
                </Text>
              </Pressable>
            </View>

            {!!error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        </KeyboardAwareScrollView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}
