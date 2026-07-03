import { login, register, verifyEmail } from "../api/client.js";
import { setSession } from "../state/store.js";
import { button, field } from "../components/ui.js";

export function renderLoginScreen() {
  const root = document.createElement("main");
  root.className = "auth-screen";
  root.innerHTML = `
    <section class="auth-panel">
      <div class="brand-mark">IP</div>
      <h1>Invoice Pocket</h1>
      <p>Sign in, upload an invoice, and let the app extract your spending data.</p>
    </section>
  `;

  const form = document.createElement("form");
  form.className = "auth-form";

  const email = document.createElement("input");
  email.type = "email";
  email.name = "email";
  email.placeholder = "you@example.com";
  email.required = true;

  const password = document.createElement("input");
  password.type = "password";
  password.name = "password";
  password.placeholder = "Password";
  password.required = true;
  password.minLength = 8;

  const pin = document.createElement("input");
  pin.type = "text";
  pin.name = "pin";
  pin.placeholder = "Verification PIN";
  pin.maxLength = 6;

  const error = document.createElement("p");
  error.className = "form-error";

  const loginButton = document.createElement("button");
  loginButton.className = "primary-button";
  loginButton.textContent = "Log in";

  const registerButton = button("Create account", "secondary-button");

  form.append(
    field("Email", email),
    field("Password", password),
    field("Verification PIN", pin),
    error,
    loginButton,
    registerButton,
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await authenticate(() => login(email.value, password.value), error);
  });

  registerButton.addEventListener("click", async () => {
    error.textContent = "";
    try {
      if (pin.value) {
        await authenticate(() => verifyEmail(email.value, pin.value), error);
        return;
      }

      await register(email.value, password.value);
      error.textContent = "Verification PIN sent. Enter it and click Create account again.";
    } catch (caught) {
      error.textContent = caught.message;
    }
  });

  root.append(form);
  return root;
}

async function authenticate(action, error) {
  error.textContent = "";

  try {
    const session = await action();
    setSession(session);
  } catch (caught) {
    error.textContent = caught.message;
  }
}
