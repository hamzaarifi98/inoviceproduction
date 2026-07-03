import logging
import os
from pathlib import Path

from paddleocr import PaddleOCR


logger = logging.getLogger(__name__)


class OCRService:
    def __init__(self):
        logger.info("Initializing PaddleOCR")

        self.ocr = PaddleOCR(
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name="cyrillic_PP-OCRv5_mobile_rec",
            device=os.getenv("OCR_DEVICE", "cpu"),
            enable_mkldnn=False,
            mkldnn_cache_capacity=1,
            cpu_threads=4,
            text_recognition_batch_size=1,
            text_det_limit_side_len=960,
            text_det_limit_type="max",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )

        logger.info("PaddleOCR initialized")

    def extract_text(self, image_path: str) -> str:
        path = Path(image_path)

        if not path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        allowed_extensions = [".jpg",".pdf", ".jpeg", ".png", ".webp"]

        if path.suffix.lower() not in allowed_extensions:
            raise ValueError(f"Unsupported file type: {path.suffix}")

        logger.info("Starting OCR extraction for %s", path.name)
        result = self.ocr.predict(str(path))

        texts = []

        for page_result in result:
            data = page_result.json["res"]
            texts.extend(data.get("rec_texts", []))

        extracted_text = "\n".join(texts)
        logger.info(
            "OCR extraction finished for %s: %s lines, %s characters",
            path.name,
            len(texts),
            len(extracted_text),
        )

        if os.getenv("OCR_DEBUG_TEXT", "").lower() in {"1", "true", "yes"}:
            logger.info("OCR extracted text:\n%s", extracted_text)

        return extracted_text


if __name__ == "__main__":
    service = OCRService()
    text = service.extract_text("data/raw/test/img")
    print(text)
