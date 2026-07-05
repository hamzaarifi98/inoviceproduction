import os
import logging
from dataclasses import dataclass

from dotenv import load_dotenv
from openai import OpenAI, LengthFinishReasonError

from app.prompts.llm import SYSTEM_PROMPT
from app.schemas.extract import ExtractedInvoice


load_dotenv()

logger = logging.getLogger(__name__)


DEFAULT_OPENAI_MODEL = "gpt-5.4-nano"
DEFAULT_OPENAI_FALLBACK_MODEL = "gpt-5.4-mini"

DEFAULT_REASONING_EFFORT = "low"
DEFAULT_FALLBACK_REASONING_EFFORT = "medium"

DEFAULT_TEXT_VERBOSITY = "low"

DEFAULT_MAX_COMPLETION_TOKENS = 4096
DEFAULT_RETRY_MAX_COMPLETION_TOKENS = 8000
DEFAULT_FINAL_MAX_COMPLETION_TOKENS = 12000

DEFAULT_MAX_OCR_CHARS = 18000


@dataclass(frozen=True)
class ExtractionAttempt:
    name: str
    model: str
    reasoning_effort: str
    max_completion_tokens: int


class LLMExtractionService:
    def __init__(self):
        self.client = OpenAI()

        self.model = os.getenv("OPENAI_MODEL", DEFAULT_OPENAI_MODEL)
        self.fallback_model = os.getenv(
            "OPENAI_FALLBACK_MODEL",
            DEFAULT_OPENAI_FALLBACK_MODEL,
        )

        self.reasoning_effort = os.getenv(
            "OPENAI_REASONING_EFFORT",
            DEFAULT_REASONING_EFFORT,
        )
        self.fallback_reasoning_effort = os.getenv(
            "OPENAI_FALLBACK_REASONING_EFFORT",
            DEFAULT_FALLBACK_REASONING_EFFORT,
        )

        self.text_verbosity = os.getenv(
            "OPENAI_TEXT_VERBOSITY",
            DEFAULT_TEXT_VERBOSITY,
        )

        self.max_completion_tokens = self._get_int_env(
            "OPENAI_MAX_COMPLETION_TOKENS",
            DEFAULT_MAX_COMPLETION_TOKENS,
        )
        self.retry_max_completion_tokens = self._get_int_env(
            "OPENAI_RETRY_MAX_COMPLETION_TOKENS",
            DEFAULT_RETRY_MAX_COMPLETION_TOKENS,
        )
        self.final_max_completion_tokens = self._get_int_env(
            "OPENAI_FINAL_MAX_COMPLETION_TOKENS",
            DEFAULT_FINAL_MAX_COMPLETION_TOKENS,
        )

        self.max_ocr_chars = self._get_int_env(
            "OPENAI_MAX_OCR_CHARS",
            DEFAULT_MAX_OCR_CHARS,
        )

    def extract_invoice_data(self, ocr_text: str) -> ExtractedInvoice:
        cleaned_ocr_text = self._prepare_ocr_text(ocr_text)

        attempts = self._build_attempts()

        last_error: Exception | None = None

        for attempt in attempts:
            try:
                return self._extract_with_model(
                    ocr_text=cleaned_ocr_text,
                    attempt=attempt,
                )

            except LengthFinishReasonError as exc:
                last_error = exc
                logger.warning(
                    "OpenAI invoice extraction hit token limit. "
                    "attempt=%s model=%s reasoning_effort=%s max_completion_tokens=%s",
                    attempt.name,
                    attempt.model,
                    attempt.reasoning_effort,
                    attempt.max_completion_tokens,
                )
                continue

            except Exception as exc:
                last_error = exc
                logger.exception(
                    "OpenAI invoice extraction failed. "
                    "attempt=%s model=%s reasoning_effort=%s max_completion_tokens=%s",
                    attempt.name,
                    attempt.model,
                    attempt.reasoning_effort,
                    attempt.max_completion_tokens,
                )
                continue

        raise RuntimeError("All OpenAI invoice extraction attempts failed") from last_error

    def _build_attempts(self) -> list[ExtractionAttempt]:
        attempts = [
            ExtractionAttempt(
                name="nano-low-4096",
                model=self.model,
                reasoning_effort=self.reasoning_effort,
                max_completion_tokens=self.max_completion_tokens,
            ),
            ExtractionAttempt(
                name="nano-low-8000",
                model=self.model,
                reasoning_effort=self.reasoning_effort,
                max_completion_tokens=self.retry_max_completion_tokens,
            ),
        ]

        if self.fallback_model and self.fallback_model != self.model:
            attempts.extend(
                [
                    ExtractionAttempt(
                        name="mini-low-8000",
                        model=self.fallback_model,
                        reasoning_effort=self.reasoning_effort,
                        max_completion_tokens=self.retry_max_completion_tokens,
                    ),
                    ExtractionAttempt(
                        name="mini-medium-12000",
                        model=self.fallback_model,
                        reasoning_effort=self.fallback_reasoning_effort,
                        max_completion_tokens=self.final_max_completion_tokens,
                    ),
                ]
            )

        return attempts

    def _extract_with_model(
        self,
        *,
        ocr_text: str,
        attempt: ExtractionAttempt,
    ) -> ExtractedInvoice:
        logger.info(
            "Starting OpenAI invoice extraction: "
            "attempt=%s model=%s reasoning_effort=%s text_verbosity=%s "
            "max_completion_tokens=%s input_chars=%s",
            attempt.name,
            attempt.model,
            attempt.reasoning_effort,
            self.text_verbosity,
            attempt.max_completion_tokens,
            len(ocr_text),
        )

        completion = self.client.chat.completions.parse(
            model=attempt.model,
            reasoning_effort=attempt.reasoning_effort,
            verbosity=self.text_verbosity,
            max_completion_tokens=attempt.max_completion_tokens,
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT,
                },
                {
                    "role": "user",
                    "content": ocr_text,
                },
            ],
            response_format=ExtractedInvoice,
        )

        usage = getattr(completion, "usage", None)
        if usage:
            logger.info(
                "OpenAI invoice extraction usage: attempt=%s usage=%s",
                attempt.name,
                usage,
            )

        message = completion.choices[0].message

        if message.parsed is None:
            refusal = getattr(message, "refusal", None)

            if refusal:
                raise ValueError(f"Invoice extraction refused: {refusal}")

            raise ValueError("Invoice extraction did not return parsed data")

        logger.info(
            "OpenAI invoice extraction succeeded: attempt=%s model=%s",
            attempt.name,
            attempt.model,
        )

        return message.parsed

    def _prepare_ocr_text(self, ocr_text: str) -> str:
        cleaned = (ocr_text or "").strip()

        if not cleaned:
            raise ValueError("OCR text is empty")

        if len(cleaned) > self.max_ocr_chars:
            logger.warning(
                "OCR text too long. Trimming from %s chars to %s chars",
                len(cleaned),
                self.max_ocr_chars,
            )
            cleaned = cleaned[: self.max_ocr_chars]

        return cleaned

    @staticmethod
    def _get_int_env(name: str, default: int) -> int:
        value = os.getenv(name)

        if value is None:
            return default

        try:
            return int(value)
        except ValueError:
            logger.warning(
                "Invalid integer env var %s=%s. Using default=%s",
                name,
                value,
                default,
            )
            return default