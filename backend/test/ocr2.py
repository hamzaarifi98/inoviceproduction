from google.cloud import vision
import io
import sys
from dotenv import load_dotenv
from pathlib import Path
import time
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

def detect_document_text(image_path):
    """Detects document text in a local image file."""
    
    # 1. Initialize the client
    client = vision.ImageAnnotatorClient()

    # 2. Load the image into memory
    with io.open(image_path, 'rb') as image_file:
        content = image_file.read()

    image = vision.Image(content=content)

    # 3. Call the document_text_detection endpoint
    response = client.document_text_detection(image=image)

    # 4. Extract the full text annotation
    if response.error.message:
        raise Exception(f'Error: {response.error.message}')
        
    # Print the raw combined text
    print(response.full_text_annotation.text)







def detect_document_text_fast(image_path):
    # 1. Open and resize the image locally to reduce payload
    with Image.open(image_path) as img:
        # Resize if width is larger than 2000px (keeps aspect ratio)
        if img.width > 2000:
            ratio = 2000.0 / float(img.width)
            new_height = int((float(img.height) * float(ratio)))
            img = img.resize((2000, new_height), Image.Resampling.LANCZOS)
        
        # Save compressed image to a byte stream
        byte_stream = io.BytesIO()
        img.save(byte_stream, format='JPEG', quality=85)
        content = byte_stream.getvalue()

    # 2. Initialize client and call API
    client = vision.ImageAnnotatorClient()
    image = vision.Image(content=content)
    response = client.document_text_detection(image=image)
    
    print(response.full_text_annotation.text)



if __name__ == "__main__":
    performance_start = time.perf_counter()
    try:
        detect_document_text_fast(PROJECT_ROOT / "data" / "uploaded" / "test.jpg")
        elapsed_seconds = time.perf_counter() - performance_start
        print(f"OCR extraction took {elapsed_seconds:.2f} seconds")
    except Exception as e:
        elapsed_seconds = time.perf_counter() - performance_start
        print(f"Error during OCR extraction: {e}", file=sys.stderr)
        print(f"OCR extraction failed after {elapsed_seconds:.2f} seconds", file=sys.stderr)
        sys.exit(1)
