from app.core.config import DATA_DIR
from app.services.database_pipeline import DatabasePipeline
from app.services.llm_extraction import LLMExtractionService
from app.services.google_ocr import GoogleOCRService

ocr_service = GoogleOCRService()
llm_service = LLMExtractionService()
database_pipeline = DatabasePipeline()

ocr_text = ocr_service.extract_text(str(DATA_DIR / "test.jpg"))
extracted_invoice = llm_service.extract_invoice_data(ocr_text)
invoice_id = database_pipeline.save_invoice(extracted_invoice)

print(extracted_invoice.model_dump_json(indent=2))
print(f"Saved invoice with ID: {invoice_id}")
