import os
import logging

from dotenv import load_dotenv
from openai import OpenAI
from app.prompts.llm import SYSTEM_PROMPT
from app.schemas.extract import ExtractedInvoice


load_dotenv()

DEFAULT_OPENAI_MODEL = "gpt-5.4-nano"
DEFAULT_OPENAI_FALLBACK_MODEL = "gpt-5.4-mini"
DEFAULT_REASONING_EFFORT = "low"
DEFAULT_FALLBACK_REASONING_EFFORT = "medium"
DEFAULT_TEXT_VERBOSITY = "low"
DEFAULT_MAX_COMPLETION_TOKENS = 4096

logger = logging.getLogger(__name__)


class LLMExtractionService:
    def __init__(self):
        self.client = OpenAI()
        self.model = os.getenv("OPENAI_MODEL", DEFAULT_OPENAI_MODEL)
        self.fallback_model = os.getenv("OPENAI_FALLBACK_MODEL", DEFAULT_OPENAI_FALLBACK_MODEL)
        self.reasoning_effort = os.getenv("OPENAI_REASONING_EFFORT", DEFAULT_REASONING_EFFORT)
        self.fallback_reasoning_effort = os.getenv(
            "OPENAI_FALLBACK_REASONING_EFFORT",
            DEFAULT_FALLBACK_REASONING_EFFORT,
        )
        self.text_verbosity = os.getenv("OPENAI_TEXT_VERBOSITY", DEFAULT_TEXT_VERBOSITY)
        self.max_completion_tokens = int(
            os.getenv("OPENAI_MAX_COMPLETION_TOKENS", str(DEFAULT_MAX_COMPLETION_TOKENS))
        )

    def extract_invoice_data(self, ocr_text: str) -> ExtractedInvoice:
        try:
            return self._extract_with_model(
                ocr_text=ocr_text,
                model=self.model,
                reasoning_effort=self.reasoning_effort,
                attempt_name="primary",
            )
        except Exception:
            if not self.fallback_model or self.fallback_model == self.model:
                raise

            logger.exception(
                "Primary OpenAI invoice extraction failed, retrying with fallback model=%s reasoning_effort=%s",
                self.fallback_model,
                self.fallback_reasoning_effort,
            )
            return self._extract_with_model(
                ocr_text=ocr_text,
                model=self.fallback_model,
                reasoning_effort=self.fallback_reasoning_effort,
                attempt_name="fallback",
            )

    def _extract_with_model(
        self,
        *,
        ocr_text: str,
        model: str,
        reasoning_effort: str,
        attempt_name: str,
    ) -> ExtractedInvoice:
        logger.info(
            "Starting OpenAI invoice extraction: attempt=%s model=%s reasoning_effort=%s text_verbosity=%s max_completion_tokens=%s input_chars=%s",
            attempt_name,
            model,
            reasoning_effort,
            self.text_verbosity,
            self.max_completion_tokens,
            len(ocr_text),
        )
        completion = self.client.chat.completions.parse(
            model=model,
            reasoning_effort=reasoning_effort,
            verbosity=self.text_verbosity,
            max_completion_tokens=self.max_completion_tokens,
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT 
                },
                {
                    "role": "user",
                    "content": ocr_text,
                },
            ],
            response_format=ExtractedInvoice,
        )

        message = completion.choices[0].message

        if message.parsed is None:
            refusal = getattr(message, "refusal", None)
            if refusal:
                raise ValueError(f"Invoice extraction refused: {refusal}")

            raise ValueError("Invoice extraction did not return parsed data")

        return message.parsed
