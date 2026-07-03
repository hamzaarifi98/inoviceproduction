import { appState, subscribe } from "./state/store.js";
import { renderLoginScreen } from "./screens/loginScreen.js";
import { renderDashboardScreen } from "./screens/dashboardScreen.js";
import { renderUploadScreen } from "./screens/uploadScreen.js";
import { renderCategoriesScreen } from "./screens/categoriesScreen.js";
import { renderHistoryScreen } from "./screens/historyScreen.js";

const routes = {
  dashboard: renderDashboardScreen,
  upload: renderUploadScreen,
  categories: renderCategoriesScreen,
  history: renderHistoryScreen,
};

export function navigate(route) {
  appState.route = route;
  renderApp();
}

export function renderApp() {
  const root = document.querySelector("#app");
  if (!root) return;

  if (!appState.session.token) {
    root.replaceChildren(renderLoginScreen());
    return;
  }

  const screen = routes[appState.route] || renderDashboardScreen;
  root.replaceChildren(screen());
}

subscribe(renderApp);
