from pathlib import Path

from app.core.config import DATA_DIR
from app.services.google_ocr import GoogleOCRService


ocr_service = GoogleOCRService()

data = ocr_service.extract_text(str(DATA_DIR / "test.jpg"))


print(data)
