import { getInvoiceResult, uploadInvoice } from "../api/client.js";
import { mobileShell } from "../components/layout.js";
import { button, card } from "../components/ui.js";
import { addInvoice, updateInvoice } from "../state/store.js";
import { detectCategory } from "../utils/categories.js";
import { DEFAULT_CURRENCY } from "../utils/currency.js";
import { getInvoiceAmount } from "../utils/invoices.js";

export function renderUploadScreen() {
  let selectedFile = null;

  const cameraInput = document.createElement("input");
  cameraInput.type = "file";
  cameraInput.accept = "image/*";
  cameraInput.capture = "environment";
  cameraInput.className = "visually-hidden-input";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*,.pdf";
  fileInput.className = "visually-hidden-input";

  const uploadButton = button("Upload invoice");
  const cameraButton = button("Take photo", "scan-action");
  const chooseButton = button("Choose file", "scan-action secondary-scan-action");
  const status = document.createElement("p");
  status.className = "upload-status";
  status.textContent = "Take a photo or choose a PDF invoice.";

  const selected = document.createElement("div");
  selected.className = "selected-file";
  selected.innerHTML = `
    <span>Selected file</span>
    <strong>No file selected</strong>
  `;

  const preview = document.createElement("div");
  preview.className = "result-preview";

  cameraButton.addEventListener("click", () => cameraInput.click());
  chooseButton.addEventListener("click", () => fileInput.click());

  cameraInput.addEventListener("change", () => {
    selectedFile = cameraInput.files?.[0] || null;
    updateSelectedFile(selected, selectedFile);
    status.textContent = selectedFile ? "Photo ready to upload." : "Take a photo or choose a PDF invoice.";
  });

  fileInput.addEventListener("change", () => {
    selectedFile = fileInput.files?.[0] || null;
    updateSelectedFile(selected, selectedFile);
    status.textContent = selectedFile ? "File ready to upload." : "Take a photo or choose a PDF invoice.";
  });

  uploadButton.addEventListener("click", async () => {
    const file = selectedFile;
    if (!file) {
      status.textContent = "Pick an invoice first.";
      return;
    }

    uploadButton.disabled = true;
    preview.replaceChildren();
    status.textContent = "Uploading invoice...";

    try {
      const upload = await uploadInvoice(file);
      addInvoice({
        ...upload,
        original_filename: file.name,
        status: upload.status,
        createdAt: new Date().toISOString(),
      });

      status.textContent = "Extracting data...";
      const result = await pollForResult(upload.invoice_file_id, status);

      if (result.invoice) {
        const category = detectCategory(result.invoice);
        updateInvoice(upload.invoice_file_id, {
          status: result.status,
          invoice: result.invoice,
          category,
          amount: getInvoiceAmount({ invoice: result.invoice }),
          currency: result.invoice.currency || DEFAULT_CURRENCY,
        });
        preview.append(renderResult(result.invoice, category));
        status.textContent = "Extraction complete.";
      } else {
        updateInvoice(upload.invoice_file_id, {
          status: result.status,
          error_message: result.error_message,
        });
        status.textContent = result.error_message || `Status: ${result.status}`;
      }
    } catch (caught) {
      status.textContent = caught.message;
    } finally {
      uploadButton.disabled = false;
    }
  });

  const actions = document.createElement("div");
  actions.className = "scan-actions";
  actions.append(cameraButton, chooseButton);

  const panel = card([
    intro(),
    actions,
    selected,
    cameraInput,
    fileInput,
    uploadButton,
    status,
    preview,
  ], "upload-card");

  return mobileShell("Scan Invoice", [panel]);
}

function updateSelectedFile(selected, file) {
  selected.querySelector("strong").textContent = file?.name || "No file selected";
}

async function pollForResult(invoiceFileId, status) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await getInvoiceResult(invoiceFileId);

    if (result.status === "processed" || result.status === "failed") {
      return result;
    }

    status.textContent = `Extracting data... ${attempt + 1}/12`;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  return getInvoiceResult(invoiceFileId);
}

function intro() {
  const element = document.createElement("div");
  element.className = "upload-intro";
  element.innerHTML = `
    <h2>Upload and extract</h2>
    <p>The app sends the invoice to the backend, waits for processing, then saves the extracted result locally for the dashboard.</p>
  `;
  return element;
}

function renderResult(invoice, category) {
  const element = document.createElement("div");
  element.className = "extracted-card";
  element.innerHTML = `
    <h3>${invoice.supplier_name || "Invoice"}</h3>
    <dl>
      <div><dt>Total</dt><dd>${invoice.total_amount || "-"}</dd></div>
      <div><dt>Date</dt><dd>${invoice.invoice_date || "-"}</dd></div>
      <div><dt>Category</dt><dd>${category.label}</dd></div>
    </dl>
  `;
  return element;
}
