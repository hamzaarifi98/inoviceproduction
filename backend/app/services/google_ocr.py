"""
Google Cloud Vision OCR service for dense document text extraction.

This service is intentionally compatible with app.services.ocr_service.OCRService:

    service = GoogleOCRService()
    text = service.extract_text("/tmp/invoice.jpg")

How to connect this instead of PaddleOCR
---------------------------------------
1. Install the Google Vision client:

       pip install google-cloud-vision

   For this project, add this line to backend/requirements.txt:

       google-cloud-vision

2. Create a Google Cloud service account with the "Cloud Vision API User" role.

3. Download the service-account JSON key and set:

       export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account.json"

   If you run the backend in Docker, mount that JSON file into the container and
   set GOOGLE_APPLICATION_CREDENTIALS to the path inside the container.

4. Enable the Cloud Vision API in the same Google Cloud project.

5. Swap the import in backend/app/services/invoice_processor.py:

       from app.services.ocr_service import OCRService

   to:

       from app.services.google_ocr import OCRService

   The rest of the processor can stay the same because both services expose
   extract_text(image_path: str) -> str.

Optional environment variables
------------------------------
- GOOGLE_VISION_LANGUAGE_HINTS: comma-separated language hints.
  Default: "mk,en"

- OCR_DEBUG_TEXT: set to 1/true/yes to log extracted text.

PDF note
--------
This file uses Google Vision's synchronous PDF/TIFF file annotation path, which
is best for short invoice PDFs. For large multi-page PDFs, use the async Google
Cloud Storage flow instead: upload the PDF to GCS, call async_batch_annotate_files,
then read the JSON output from the configured GCS destination.
"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

try:
    from google.cloud import vision
except ImportError:  # pragma: no cover - gives a clearer runtime error.
    vision = None


logger = logging.getLogger(__name__)
PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / ".env")


class GoogleOCRService:
    def __init__(self):
        if vision is None:
            raise ImportError(
                "google-cloud-vision is not installed. "
                "Install it with: pip install google-cloud-vision"
            )

        logger.info("Initializing Google Cloud Vision OCR")
        _configure_google_credentials_path()
        self.client = vision.ImageAnnotatorClient()
        self.language_hints = _get_language_hints()
        logger.info("Google Cloud Vision OCR initialized")

    def extract_text(self, image_path: str) -> str:
        path = Path(image_path)

        if not path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        allowed_extensions = [".jpg", ".pdf", ".jpeg", ".png", ".webp"]

        if path.suffix.lower() not in allowed_extensions:
            raise ValueError(f"Unsupported file type: {path.suffix}")

        logger.info("Starting Google Vision OCR extraction for %s", path.name)

        if path.suffix.lower() == ".pdf":
            extracted_text = self._extract_pdf_text(path)
        else:
            extracted_text = self._extract_image_text(path)

        line_count = len([line for line in extracted_text.splitlines() if line.strip()])
        logger.info(
            "Google Vision OCR extraction finished for %s: %s lines, %s characters",
            path.name,
            line_count,
            len(extracted_text),
        )

        if os.getenv("OCR_DEBUG_TEXT", "").lower() in {"1", "true", "yes"}:
            logger.info("Google Vision OCR extracted text:\n%s", extracted_text)

        return extracted_text

    def _extract_image_text(self, path: Path) -> str:
        content = path.read_bytes()
        image = vision.Image(content=content)
        image_context = vision.ImageContext(language_hints=self.language_hints)

        response = self.client.document_text_detection(
            image=image,
            image_context=image_context,
        )
        _raise_for_google_error(response)

        return response.full_text_annotation.text or ""

    def _extract_pdf_text(self, path: Path) -> str:
        content = path.read_bytes()
        input_config = vision.InputConfig(
            content=content,
            mime_type="application/pdf",
        )
        feature = vision.Feature(type_=vision.Feature.Type.DOCUMENT_TEXT_DETECTION)
        image_context = vision.ImageContext(language_hints=self.language_hints)
        request = vision.AnnotateFileRequest(
            input_config=input_config,
            features=[feature],
            image_context=image_context,
        )

        response = self.client.batch_annotate_files(requests=[request])

        texts = []
        for file_response in response.responses:
            _raise_for_google_error(file_response)

            for page_response in file_response.responses:
                _raise_for_google_error(page_response)
                page_text = page_response.full_text_annotation.text

                if page_text:
                    texts.append(page_text)

        return "\n".join(texts)


def _get_language_hints() -> list[str]:
    raw_value = os.getenv("GOOGLE_VISION_LANGUAGE_HINTS", "mk,en")
    return [language.strip() for language in raw_value.split(",") if language.strip()]


def _configure_google_credentials_path() -> None:
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    if not credentials_path:
        raise RuntimeError(
            "GOOGLE_APPLICATION_CREDENTIALS is missing. Set it to your Google "
            "service-account JSON path."
        )

    path = Path(credentials_path).expanduser()

    if not path.is_absolute():
        path = PROJECT_ROOT / path
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(path)

    if not path.exists():
        raise FileNotFoundError(
            "Google credentials file was not found at "
            f"{path}. Check GOOGLE_APPLICATION_CREDENTIALS in .env."
        )


def _raise_for_google_error(response) -> None:
    error = getattr(response, "error", None)

    if error and getattr(error, "message", ""):
        raise RuntimeError(f"Google Vision OCR failed: {error.message}")


OCRService = GoogleOCRService


if __name__ == "__main__":
    service = GoogleOCRService()
    text = service.extract_text("data/raw/test/img")
    print(text)
