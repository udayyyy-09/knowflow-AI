"""
Google Gemini LLM Provider.
Connects to Google's Generative Language API (e.g. gemini-1.5-flash, gemini-2.5-flash).
Supports both blocking generateContent and real-time SSE streamGenerateContent.
"""
import json
import time
import logging
import requests
from typing import Iterator, Optional
from django.conf import settings

from apps.chat.pipeline.llm.base import BaseLLMProvider, LLMResponse

logger = logging.getLogger(__name__)


class GeminiLLMProvider(BaseLLMProvider):
    """
    Google Gemini Generative AI provider with streaming and usage tracking.
    """

    API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
    ):
        self.api_key = api_key if api_key is not None else getattr(settings, "GEMINI_API_KEY", "")
        raw_name = model_name or getattr(settings, "LLM_MODEL_NAME", "gemini-3.1-flash-lite")
        # Normalize model name
        self.model_name = raw_name.replace("models/", "").strip() or "gemini-3.1-flash-lite"
        self.temperature = temperature if temperature is not None else getattr(settings, "LLM_TEMPERATURE", 0.2)
        self.max_tokens = max_tokens or getattr(settings, "LLM_MAX_TOKENS", 1024)
        self.timeout_seconds = timeout_seconds or getattr(settings, "LLM_TIMEOUT_SECONDS", 45)

        if not self.api_key:
            logger.warning("Gemini API key is unset. GeminiLLMProvider calls will fail unless provided.")

    def _build_payload(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> dict:
        temp = temperature if temperature is not None else self.temperature
        max_tok = max_tokens or self.max_tokens
        return {
            "system_instruction": {
                "parts": [{"text": system_prompt}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_prompt}]
                }
            ],
            "generationConfig": {
                "temperature": temp,
                "maxOutputTokens": max_tok,
            }
        }

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
    ) -> LLMResponse:
        """
        Executes a synchronous completion call to Gemini generateContent.
        """
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured in settings or environment.")

        url = f"{self.API_BASE}/{self.model_name}:generateContent?key={self.api_key}"
        payload = self._build_payload(system_prompt, user_prompt, temperature, max_tokens)
        timeout = timeout_seconds or self.timeout_seconds

        t0 = time.perf_counter()
        try:
            response = requests.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=timeout,
            )
        except requests.exceptions.Timeout:
            logger.error("Gemini API call timed out after %ds for model '%s'", timeout, self.model_name)
            raise TimeoutError(f"Gemini API timed out after {timeout} seconds.")
        except requests.exceptions.RequestException as e:
            logger.error("Network error communicating with Gemini API: %s", str(e))
            raise RuntimeError(f"Network error communicating with Gemini API: {str(e)}") from e

        latency_ms = int((time.perf_counter() - t0) * 1000)

        if response.status_code != 200:
            error_msg = f"Gemini API error [{response.status_code}]: {response.text}"
            logger.error(error_msg)
            raise RuntimeError(error_msg)

        data = response.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise ValueError(f"Gemini returned no response candidates: {data}")

        candidate = candidates[0]
        content_parts = candidate.get("content", {}).get("parts", [])
        content_text = "".join(part.get("text", "") for part in content_parts)

        # Extract token usage metadata if provided
        usage = data.get("usageMetadata", {})
        prompt_tokens = usage.get("promptTokenCount", 0)
        completion_tokens = usage.get("candidatesTokenCount", 0)
        total_tokens = usage.get("totalTokenCount", prompt_tokens + completion_tokens)

        return LLMResponse(
            content=content_text,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            latency_ms=latency_ms,
            model_name=self.model_name,
        )

    def generate_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
    ) -> Iterator[str]:
        """
        Streams tokens from Gemini using streamGenerateContent with alt=sse.
        Yields text token deltas.
        """
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured in settings or environment.")

        url = f"{self.API_BASE}/{self.model_name}:streamGenerateContent?alt=sse&key={self.api_key}"
        payload = self._build_payload(system_prompt, user_prompt, temperature, max_tokens)
        timeout = timeout_seconds or self.timeout_seconds

        try:
            with requests.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
                stream=True,
                timeout=timeout,
            ) as response:
                if response.status_code != 200:
                    error_msg = f"Gemini stream API error [{response.status_code}]: {response.text}"
                    logger.error(error_msg)
                    raise RuntimeError(error_msg)

                for line in response.iter_lines():
                    if not line:
                        continue
                    line_str = line.decode("utf-8")
                    if line_str.startswith("data: "):
                        data_str = line_str[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk_json = json.loads(data_str)
                            candidates = chunk_json.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                for p in parts:
                                    text_delta = p.get("text", "")
                                    if text_delta:
                                        yield text_delta
                        except json.JSONDecodeError:
                            continue
        except requests.exceptions.Timeout:
            logger.error("Gemini stream timed out after %ds", timeout)
            raise TimeoutError(f"Gemini stream timed out after {timeout} seconds.")
        except requests.exceptions.RequestException as e:
            logger.error("Network error during Gemini streaming: %s", str(e))
            raise RuntimeError(f"Network error during Gemini streaming: {str(e)}") from e

    def get_model_name(self) -> str:
        return self.model_name
