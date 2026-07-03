import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, View } from "react-native";

import { useInvoiceApp } from "./src/api/useInvoiceApp";
import { BottomNav } from "./src/components/BottomNav";
import { Header } from "./src/components/Header";
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
  const t = (key, params) => translate(app.language, key, params);

  if (!app.isReady) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator color="#116b5f" />
      </SafeAreaView>
    );
  }

  async function logout() {
    setRoute("dashboard");
    await app.logout();
  }

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="dark" />
      <View style={styles.phoneShell}>
        <Header
          title={t(routeLabels[route] || routeLabels.dashboard)}
          user={app.session.user}
          language={app.language}
          updateLanguage={app.updateLanguage}
          onLogout={logout}
          t={t}
        />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {route === "dashboard" && <DashboardScreen app={app} t={t} />}
          {route === "login" && <LoginScreen app={app} onAuthenticated={() => setRoute("dashboard")} />}
          {route === "upload" && <UploadScreen app={app} t={t} onRequireAccount={() => setRoute("login")} />}
          {route === "categories" && <CategoriesScreen invoices={app.invoices} t={t} />}
          {route === "history" && <HistoryScreen app={app} t={t} />}
        </ScrollView>
        {route !== "login" && <BottomNav route={route} setRoute={setRoute} t={t} />}
      </View>
    </SafeAreaView>
  );
}
