from pathlib import Path
import sys
import time

project_root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(project_root))

file_path = project_root / "data" / "uploaded" / "test.jpg"

from backend.app.services.google_ocr import GoogleOCRService


ocr_service = GoogleOCRService()

start_time = time.perf_counter()

try:
    extracted_text = ocr_service.extract_text(str(file_path))
    elapsed_seconds = time.perf_counter() - start_time
    print("Extracted text:")
    print(extracted_text)
    print(f"OCR extraction took {elapsed_seconds:.2f} seconds")
except Exception as e:
    elapsed_seconds = time.perf_counter() - start_time
    print(f"Error during OCR extraction: {e}", file=sys.stderr)
    print(f"OCR extraction failed after {elapsed_seconds:.2f} seconds", file=sys.stderr)
    sys.exit(1)
