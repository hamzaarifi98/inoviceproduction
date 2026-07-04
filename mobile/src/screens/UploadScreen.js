import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { pollForResult } from "../api/invoices";
import { ActionTile, Card, PrimaryButton } from "../components/Card";
import { ManualInvoiceForm } from "../components/ManualInvoiceForm";
import { DEFAULT_CURRENCY, FREE_SCAN_LIMIT } from "../constants";
import { styles } from "../styles/styles";
import { detectCategory } from "../utils/categories";
import { getInvoiceAmount } from "../utils/invoices";

export function UploadScreen({ app, t, onRequireAccount }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState(t("initialStatus"));
  const [isUploading, setIsUploading] = useState(false);
  const [mode, setMode] = useState("scan");
  const isPro = Boolean(app.scanUsage?.is_pro || app.session.user?.is_pro);
  const usedScans = app.scanUsage?.used_scans ?? app.invoices.length;
  const freeScanLimit = app.scanUsage?.free_scan_limit ?? FREE_SCAN_LIMIT;
  const freeScansLeft = app.scanUsage?.remaining_free_scans ?? Math.max(freeScanLimit - usedScans, 0);
  const needsPro = !isPro && usedScans >= freeScanLimit;

  async function takePhoto() {
    if (needsPro) {
      setStatus(t("proRequired"));
      onRequireAccount?.();
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(t("cameraPermissionTitle"), t("cameraPermissionCopy"));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.65,
    });

    if (!result.canceled && result.assets?.[0]) {
      selectAsset(result.assets[0], t("photoReady"));
    }
  }

  async function chooseImage() {
    if (needsPro) {
      setStatus(t("proRequired"));
      onRequireAccount?.();
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.65,
    });

    if (!result.canceled && result.assets?.[0]) {
      selectAsset(result.assets[0], t("imageReady"));
    }
  }

  async function choosePdf() {
    if (needsPro) {
      setStatus(t("proRequired"));
      onRequireAccount?.();
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setSelectedFile({
        uri: asset.uri,
        name: asset.name || `invoice-${Date.now()}.pdf`,
        type: asset.mimeType || "application/pdf",
      });
      setStatus(t("pdfReady"));
    }
  }

  function selectAsset(asset, nextStatus) {
    setSelectedFile({
      uri: asset.uri,
      name: asset.fileName || `invoice-${Date.now()}.jpg`,
      type: asset.mimeType || "image/jpeg",
    });
    setStatus(nextStatus);
  }

  async function uploadSelectedFile() {
    if (needsPro) {
      setStatus(t("proRequired"));
      onRequireAccount?.();
      return;
    }

    if (!selectedFile) {
      setStatus(t("chooseInvoice"));
      return;
    }

    setIsUploading(true);
    setStatus(t("uploading"));

    try {
      const totalStart = Date.now();

      const uploadStart = Date.now();
      const presignData = await app.request("/invoices/upload-url", {
        method: "POST",
        body: JSON.stringify({
          original_filename: selectedFile.name,
        }),
      });
      app.incrementScanUsage?.();

      const s3FormData = new FormData();

      Object.entries(presignData.fields).forEach(([key, value]) => {
        s3FormData.append(key, value);
      });

      s3FormData.append("file", selectedFile);

      const s3Response = await fetch(presignData.upload_url, {
        method: "POST",
        body: s3FormData,
      });

      if (!s3Response.ok) {
        throw new Error("Could not upload invoice to S3.");
      }

      const upload = await app.request("/invoices/complete-upload", {
        method: "POST",
        body: JSON.stringify({
          invoice_file_id: presignData.invoice_file_id,
          s3_key: presignData.s3_key,
        }),
        timeoutMs: 120000,
        timeoutMessage: "Upload took too long. Please try again with a smaller file or better connection.",
      });
      console.log(`[upload] Direct S3 upload flow took ${((Date.now() - uploadStart) / 1000).toFixed(2)}s`);

      app.addInvoice({
        ...upload,
        original_filename: selectedFile.name,
        status: upload.status,
        createdAt: new Date().toISOString(),
      });

      setStatus(t("extracting"));
      const processingStart = Date.now();
      const result = await pollForResult(app.request, upload.invoice_file_id, setStatus);
      console.log(`[upload] Processing wait took ${((Date.now() - processingStart) / 1000).toFixed(2)}s`);
      console.log(`[upload] Total upload flow took ${((Date.now() - totalStart) / 1000).toFixed(2)}s`);

      if (result.invoice) {
        Alert.alert(t("complete"), result.invoice.supplier_name || t("invoice"));
        app.updateInvoice(upload.invoice_file_id, {
          status: result.status,
          invoice: result.invoice,
          category: detectCategory(result.invoice),
          amount: getInvoiceAmount({ invoice: result.invoice }),
          currency: result.invoice.currency || DEFAULT_CURRENCY,
          error_message: null,
        });
        setStatus(t("complete"));
        setSelectedFile(null);
      } else {
        app.updateInvoice(upload.invoice_file_id, {
          status: result.status,
          error_message: result.error_message || null,
        });
        const statusMessage =
          result.status === "processing" || result.status === "uploaded" || result.status === "processing_queued"
            ? t("stillExtracting")
            : `${t("status")}: ${result.status}`;

        setStatus(result.error_message || statusMessage);
      }
    } catch (caught) {
      setStatus(caught.message);
    } finally {
      setIsUploading(false);
    }
  }

  function saveManualInvoice(invoice, categoryId) {
    const invoiceFileId = `manual-${Date.now()}`;

    app.addInvoice({
      invoice_file_id: invoiceFileId,
      original_filename: t("manualInvoice"),
      status: "processed",
      invoice,
      category: { id: categoryId || detectCategory(invoice).id },
      amount: getInvoiceAmount({ invoice }),
      currency: invoice.currency || DEFAULT_CURRENCY,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: "manual",
    });

    setStatus(t("manualSaved"));
    Alert.alert(t("manualSaved"), invoice.supplier_name || t("invoice"));
  }

  return (
    <>
      <Card style={isPro ? styles.proCardActive : styles.proCard}>
        <View style={styles.proHeader}>
          <View style={styles.invoiceText}>
            <Text style={styles.sectionTitle}>{isPro ? t("proActive") : t("proTitle")}</Text>
            <Text style={styles.helperText}>{isPro ? t("proActiveCopy") : t("proCopy")}</Text>
          </View>
          <Text style={styles.proBadge}>{isPro ? "PRO" : t("scansUsed", { count: Math.min(usedScans, freeScanLimit) })}</Text>
        </View>
        {!isPro && (
          <>
            <Text style={[styles.statusText, needsPro && styles.errorText]}>
              {needsPro ? t("proRequired") : t("scansLeft", { count: freeScansLeft })}
            </Text>
            <PrimaryButton title={t("upgrade")} onPress={onRequireAccount} />
          </>
        )}
      </Card>

      <Card>
        <View style={styles.segmented}>
          <Pressable
            onPress={() => setMode("scan")}
            style={[styles.segmentButton, mode === "scan" && styles.segmentButtonActive]}
          >
            <Text style={[styles.segmentText, mode === "scan" && styles.segmentTextActive]}>{t("scanTab")}</Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("manual")}
            style={[styles.segmentButton, mode === "manual" && styles.segmentButtonActive]}
          >
            <Text style={[styles.segmentText, mode === "manual" && styles.segmentTextActive]}>{t("manual")}</Text>
          </Pressable>
        </View>

        {mode === "manual" ? (
          <>
            <Text style={styles.sectionTitle}>{t("manualInvoice")}</Text>
            <Text style={styles.helperText}>{t("manualInvoiceCopy")}</Text>
            <ManualInvoiceForm onSave={saveManualInvoice} t={t} />
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>{t("scanOrChoose")}</Text>
            <Text style={styles.helperText}>{t("scanHelper")}</Text>

            <View style={styles.scanGrid}>
              <ActionTile title={t("camera")} copy={t("cameraCopy")} onPress={takePhoto} />
              <ActionTile title={t("gallery")} copy={t("galleryCopy")} onPress={chooseImage} />
              <ActionTile title={t("pdf")} copy={t("pdfCopy")} onPress={choosePdf} />
            </View>

            <View style={styles.selectedFile}>
              <Text style={styles.selectedLabel}>{t("selectedFile")}</Text>
              <Text style={styles.selectedName}>{selectedFile?.name || t("noFileSelected")}</Text>
            </View>

            <PrimaryButton title={t("uploadInvoice")} busy={isUploading} disabled={needsPro} onPress={uploadSelectedFile} />
            <Text style={[styles.statusText, (status === t("chooseInvoice") || status === t("proRequired")) && styles.errorText]}>
              {status}
            </Text>
          </>
        )}
      </Card>
    </>
  );
}
