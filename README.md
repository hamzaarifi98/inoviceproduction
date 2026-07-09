# AI Fiskalna

Scan a Macedonian fiscal receipt with your phone, and get back a structured
invoice — supplier, date, tax breakdown, and line items each tagged with a
spending category — without typing anything in by hand. The app then tracks
spend over time and by category, and exports it to CSV.

This repo is a monorepo with three pieces:

```
backend/    FastAPI + Postgres API: auth, uploads, OCR/LLM pipeline, CSV/history data
mobile/     React Native (Expo) app — the actively developed client
frontend/   Small static HTML/JS web client (early companion client, same API)
data/       Sample receipt dataset used while prototyping OCR/extraction
```

By trying different approaches to optimize the flow, I came to these components where I believe are the optimal between cost and latency.
As a cloud to host the backend I used render. As a database Neon Database for postgres, for the presigned uploadS3 AWS.

React native is used to build the app for android and IOS. 

It takes 10-15 seconds for the whole flow


## How a scan works, end to end

1. **Mobile requests a presigned upload.** `POST /invoices/upload-url` creates
   an `invoice_files` row (`status=waiting_upload`) and returns an S3
   presigned POST (URL + fields), scoped to one object key, one content type,
   a size cap, and a 5-minute expiry.
2. **The phone uploads the file straight to S3** — the bytes never touch the
   API server. See [Why direct-to-S3](#why-direct-to-s3-presigned-uploads)
   below.
3. **Mobile calls `POST /invoices/complete-upload`** with the S3 key. The
   backend re-checks the object actually exists in S3, re-validates its size,
   content type, and file signature (magic bytes — a `Content-Type` header
   is just a claim, this checks the real bytes), marks the row `uploaded`,
   and queues background processing via FastAPI `BackgroundTasks`. The
   response comes back immediately — the phone doesn't block on OCR.
4. **In the background**, `process_invoice_from_s3` (`invoice_processor.py`):
   - downloads the object from S3 to a temp file,
   - runs OCR (Google Cloud Vision, see below),
   - sends the OCR text to an LLM to extract structured fields, and
   - saves the parsed `Invoice`/`InvoiceItem` rows.

   Every stage is individually timed (`time.perf_counter()`) and the
   duration is persisted as a row in `invoice_processing_logs` via
   `log_pipeline_event(...)` — upload → download → OCR → LLM → DB save. That
   table (exposed at `GET /invoices/files/{id}/logs`) is the real source of
   truth for how long each step takes on any given invoice; nothing here is
   a made-up benchmark number.
5. **Mobile polls `GET /invoices/files/{id}/result`** every ~2.5s until the
   file is `processed` or `failed`, then renders the invoice.

## Why direct-to-S3 presigned uploads

The upload path used to (and still can, via `POST /invoices/upload`) proxy
the raw file bytes through the FastAPI server: phone → API server → S3. That
means the API server's request thread is tied up for the whole upload, on a
single small web dyno (this runs on Render), for every concurrent scan.
This approach reduced latency by 8 seconds approx.

The presigned-POST flow (`create_presigned_post` in `s3_service.py`, wired up
in `create_invoice_upload`/`complete_invoice_upload`) has the phone upload
**directly to S3**, and the API server only ever sees small JSON calls:
"give me a URL" and "I'm done, here's the key." The API server's job shrinks
from "receive and forward megabytes of image data" to "issue a signed URL and
metadata-check a completed upload" — so it stays responsive under concurrent
uploads regardless of file size or the uploader's connection speed, and the
upload itself runs at S3's ingest speed instead of being bottlenecked by the
backend's own bandwidth. The presigned POST also constrains content type,
content length, and forces server-side encryption at the S3 level, so those
constraints are enforced before a single byte reaches application code.

## OCR: Google Cloud Vision, not PaddleOCR

Both exist in this codebase — that's not an accident, it's the paper trail:

- `backend/app/services/ocr_service.py` — a self-hosted **PaddleOCR** setup,
  explicitly configured with `cyrillic_PP-OCRv5_mobile_rec` (a Cyrillic
  recognition model, since Macedonian receipts are Cyrillic) and CPU-tuned
  (`enable_mkldnn`, `cpu_threads`, batch size 1).
- `backend/app/services/google_ocr.py` — **Google Cloud Vision**, with a
  docstring that documents, step by step, how to swap it back in for
  PaddleOCR ("This service is intentionally compatible with
  `app.services.ocr_service.OCRService`").
- `backend/app/services/google_ocr2.py` (`GoogleOCRFastService`) — this is
  the one actually wired into `invoice_processor.py` today.

PaddleOCR means running and maintaining an ML inference model (weights,
CPU/thread tuning, `mkldnn` cache) inside the same process that also needs to
stay responsive as a web API — on a small Render instance, that's inference
work competing with request-handling for the same CPU. Google Vision moves
that entirely off-box: `document_text_detection` with
`language_hints=["mk", "en"]` is a managed API call — no model to host,
tune, or keep warm, and Google's document-text model handles dense,
low-quality phone-camera receipt photos (skew, glare, small print) more
robustly out of the box than a self-hosted mobile-sized recognition model.
The trade-off is per-call cost and a network round trip instead of local
inference — acceptable here since OCR already happens in a background task,
not on the request path the user is waiting on.

### Shrinking the OCR payload

`GoogleOCRFastService._prepare_image_content` (in `google_ocr2.py`) resizes
the image to a max width (`GOOGLE_OCR_MAX_IMAGE_WIDTH`, default 2000px) and
re-encodes it as JPEG at a set quality (`GOOGLE_OCR_JPEG_QUALITY`, default
85) *before* sending it to Vision, and logs the before/after size. Phone
camera photos are routinely 3000px+ and several MB; a fiscal receipt doesn't
need that resolution to OCR cleanly, so this cuts the upload payload to
Google's API — and therefore the round-trip time — substantially, for
resolution the OCR wasn't using anyway. The reasoning and a repeatable local
benchmark for this live in `backend/test/ocr2.py`
(`detect_document_text` vs `detect_document_text_fast`), which is where this
approach was measured before it became the production path.

## LLM extraction: cheap model first, escalate only on failure

`LLMExtractionService` (`llm_extraction.py`) doesn't call one fixed model. It
tries a small ordered list of attempts and stops at the first success:

1. `gpt-5.4-nano`, low reasoning effort, small token budget
2. same model, more completion tokens (covers receipts with lots of items)
3. `gpt-5.4-mini`, low reasoning effort, more tokens
4. `gpt-5.4-mini`, medium reasoning effort, largest token budget

Most receipts are short and succeed on attempt 1 — the cheapest, fastest
model — and the pipeline only pays for a bigger model's latency and cost
when a receipt actually needs it (hit the token limit, or the smaller model
couldn't produce valid structured output). Structured output is enforced via
`response_format=ExtractedInvoice` (a Pydantic schema), so the response is
either valid parsed JSON or the attempt is treated as failed and escalated.

## Data model

- `users` — email/password auth, guest accounts, email verification, `is_pro`
- `invoice_files` — one row per uploaded file; tracks S3 key, status
  (`waiting_upload → uploaded → processing → processed|failed`), timestamps
- `invoices` / `invoice_items` — the extracted structured data, cascade-deleted
  with their `invoice_files` row
- `invoice_processing_logs` — per-stage pipeline timing/status, see above

## Other things worth knowing about

- **Rate limiting** (`core/rate_limit.py`) is a simple in-memory sliding
  window applied to auth-sensitive endpoints (login, subscribe, password
  reset) — enough to blunt brute-force/abuse without needing Redis.
- **Free-tier scan limit** is enforced server-side (`_enforce_scan_access`),
  not just in the mobile UI, so it can't be bypassed by calling the API
  directly.
- **File signature validation** (`invoice_file_rules.py`) checks actual
  magic bytes against the claimed content type, so a spoofed
  `Content-Type` header on a presigned upload doesn't get treated as trusted.
- An experimental **knowledge-graph extraction path** (`app/graph/`, Neo4j)
  and a `backend/app/api/document.py` module exist in the tree but aren't
  wired into `main.py` — exploratory work, not part of the active pipeline.
  `data/raw/{train,test}` is a public receipt dataset (img/box/entities)
  used while prototyping OCR/extraction, not real user data.




