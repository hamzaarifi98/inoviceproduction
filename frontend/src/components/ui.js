export function card(children, className = "") {
  const element = document.createElement("article");
  element.className = `card ${className}`.trim();
  children.forEach((child) => element.append(child));
  return element;
}

export function button(label, className = "primary-button") {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  return element;
}

export function stat(label, value) {
  const element = document.createElement("div");
  element.className = "stat";
  element.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
  return element;
}

export function emptyState(title, message) {
  const element = document.createElement("div");
  element.className = "empty-state";
  element.innerHTML = `<h2>${title}</h2><p>${message}</p>`;
  return element;
}

export function field(label, input) {
  const wrapper = document.createElement("label");
  wrapper.className = "field";
  wrapper.append(labelNode(label), input);
  return wrapper;
}

function labelNode(text) {
  const element = document.createElement("span");
  element.textContent = text;
  return element;
}
