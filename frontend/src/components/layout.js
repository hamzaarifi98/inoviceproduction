import { appState, logout } from "../state/store.js";
import { navigate } from "../router.js";

export function mobileShell(title, children) {
  const shell = document.createElement("main");
  shell.className = "phone-shell";

  shell.append(header(title), content(children), nav());
  return shell;
}

function header(title) {
  const element = document.createElement("header");
  element.className = "app-header";
  element.innerHTML = `
    <div>
      <p>${appState.session.user?.email || "Invoice Pocket"}</p>
      <h1>${title}</h1>
    </div>
    <button class="icon-button" type="button" aria-label="Log out">Out</button>
  `;
  element.querySelector("button").addEventListener("click", logout);
  return element;
}

function content(children) {
  const element = document.createElement("section");
  element.className = "screen-content";
  children.forEach((child) => element.append(child));
  return element;
}

function nav() {
  const element = document.createElement("nav");
  element.className = "bottom-nav";

  [
    ["dashboard", "Home"],
    ["upload", "Scan"],
    ["categories", "Spend"],
    ["history", "List"],
  ].forEach(([route, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = appState.route === route ? "active" : "";
    button.addEventListener("click", () => navigate(route));
    element.append(button);
  });

  return element;
}
