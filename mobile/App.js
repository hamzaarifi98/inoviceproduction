import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, View } from "react-native";

import { useInvoiceApp } from "./src/api/useInvoiceApp";
import { BottomNav } from "./src/components/BottomNav";
import { Header } from "./src/components/Header";
import { SettingsDrawer } from "./src/components/SettingsDrawer";
import { routeLabels } from "./src/constants";
import { translate } from "./src/i18n";
import { CategoriesScreen } from "./src/screens/CategoriesScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { UploadScreen } from "./src/screens/UploadScreen";
import { styles } from "./src/styles/styles";

export default function App() {
  const app = useInvoiceApp();
  const [route, setRoute] = useState("dashboard");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const t = (key, params) => translate(app.language, key, params);

  if (!app.isReady) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator color="#116b5f" />
      </SafeAreaView>
    );
  }

  async function logout() {
    setIsSettingsOpen(false);
    await app.logout();
    setRoute("login");
  }

  function openSettings() {
    setIsSettingsOpen(true);
  }

  function goToLoginFromSettings() {
    setIsSettingsOpen(false);
    setRoute("login");
  }

  if (route === "login") {
    return (
      <LoginScreen
        app={app}
        onAuthenticated={() => setRoute("dashboard")}
      />
    );
  }

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="light" />
      <View style={styles.phoneShell}>
        <Header
          title={t(routeLabels[route] || routeLabels.dashboard)}
          user={app.session.user}
          language={app.language}
          updateLanguage={app.updateLanguage}
          onOpenSettings={openSettings}
          isSettingsOpen={isSettingsOpen}
          t={t}
        />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {route === "dashboard" && <DashboardScreen app={app} t={t} />}
          {route === "upload" && <UploadScreen app={app} t={t} onManagePro={openSettings} />}
          {route === "categories" && <CategoriesScreen invoices={app.invoices} t={t} />}
          {route === "history" && <HistoryScreen app={app} t={t} />}
        </ScrollView>
        <BottomNav route={route} setRoute={setRoute} t={t} />
        <SettingsDrawer
          visible={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onLogin={goToLoginFromSettings}
          onLogout={logout}
          app={app}
          t={t}
        />
      </View>
    </SafeAreaView>
  );
}
