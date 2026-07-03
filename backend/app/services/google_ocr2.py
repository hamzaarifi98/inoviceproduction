"""
Fast Google Cloud Vision OCR service.

This variant keeps the same public interface as google_ocr.GoogleOCRService,
but compresses large image files before sending them to Google Vision:

    service = GoogleOCRFastService()
    text = service.extract_text("/tmp/invoice.jpg")
"""

import io
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

try:
    from google.cloud import vision
except ImportError:  # pragma: no cover - gives a clearer runtime error.
    vision = None

try:
    from PIL import Image
except ImportError:  # pragma: no cover - gives a clearer runtime error.
    Image = None


logger = logging.getLogger(__name__)
PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / ".env")

GOOGLE_VISION_LANGUAGE_HINTS = [
    language.strip()
    for language in os.getenv("GOOGLE_VISION_LANGUAGE_HINTS", "mk,en").split(",")
    if language.strip()
]
GOOGLE_OCR_MAX_IMAGE_WIDTH = int(os.getenv("GOOGLE_OCR_MAX_IMAGE_WIDTH", "2000"))
GOOGLE_OCR_JPEG_QUALITY = int(os.getenv("GOOGLE_OCR_JPEG_QUALITY", "85"))


class GoogleOCRFastService:
    def __init__(self):
        if vision is None:
            raise ImportError(
                "google-cloud-vision is not installed. "
                "Install it with: pip install google-cloud-vision"
            )

        if Image is None:
            raise ImportError("Pillow is not installed. Install it with: pip install Pillow")

        logger.info("Initializing fast Google Cloud Vision OCR")
        _configure_google_credentials_path()
        self.client = vision.ImageAnnotatorClient()
        self.language_hints = GOOGLE_VISION_LANGUAGE_HINTS
        self.max_image_width = GOOGLE_OCR_MAX_IMAGE_WIDTH
        self.jpeg_quality = GOOGLE_OCR_JPEG_QUALITY
        logger.info("Fast Google Cloud Vision OCR initialized")

    def extract_text(self, image_path: str) -> str:
        path = Path(image_path)

        if not path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        allowed_extensions = [".jpg", ".pdf", ".jpeg", ".png", ".webp"]

        if path.suffix.lower() not in allowed_extensions:
            raise ValueError(f"Unsupported file type: {path.suffix}")

        logger.info("Starting fast Google Vision OCR extraction for %s", path.name)

        if path.suffix.lower() == ".pdf":
            extracted_text = self._extract_pdf_text(path)
        else:
            extracted_text = self._extract_fast_image_text(path)

        line_count = len([line for line in extracted_text.splitlines() if line.strip()])
        logger.info(
            "Fast Google Vision OCR extraction finished for %s: %s lines, %s characters",
            path.name,
            line_count,
            len(extracted_text),
        )

        if os.getenv("OCR_DEBUG_TEXT", "").lower() in {"1", "true", "yes"}:
            logger.info("Fast Google Vision OCR extracted text:\n%s", extracted_text)

        return extracted_text

    def _extract_fast_image_text(self, path: Path) -> str:
        content = self._prepare_image_content(path)
        image = vision.Image(content=content)
        image_context = vision.ImageContext(language_hints=self.language_hints)

        response = self.client.document_text_detection(
            image=image,
            image_context=image_context,
        )
        _raise_for_google_error(response)

        return response.full_text_annotation.text or ""

    def _prepare_image_content(self, path: Path) -> bytes:
        with Image.open(path) as img:
            original_width = img.width
            original_height = img.height
            original_bytes = path.stat().st_size

            if img.width > self.max_image_width:
                ratio = self.max_image_width / float(img.width)
                new_height = int(float(img.height) * ratio)
                img = img.resize((self.max_image_width, new_height), Image.Resampling.LANCZOS)

            if img.mode not in {"RGB", "L"}:
                img = img.convert("RGB")

            byte_stream = io.BytesIO()
            img.save(byte_stream, format="JPEG", quality=self.jpeg_quality)
            content = byte_stream.getvalue()

            logger.info(
                "Prepared image for Google OCR: %sx%s/%s bytes -> %sx%s/%s bytes",
                original_width,
                original_height,
                original_bytes,
                img.width,
                img.height,
                len(content),
            )

            return content

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


OCRService = GoogleOCRFastService
