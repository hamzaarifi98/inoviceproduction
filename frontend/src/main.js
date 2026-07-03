import { renderApp } from "./router.js";
import { hydrateSession } from "./state/store.js";

hydrateSession();
renderApp();
