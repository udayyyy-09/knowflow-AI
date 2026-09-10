"""
OpenAI LLM Provider.
Connects to OpenAI's Chat Completions API (e.g. gpt-4o-mini, gpt-4o, gpt-3.5-turbo).
Supports both standard completions and SSE token streaming.
"""
import json
import time
import logging
import requests
from typing import Iterator, Optional
from django.conf import settings

from apps.chat.pipeline.llm.base import BaseLLMProvider, LLMResponse

logger = logging.getLogger(__name__)


class OpenAILLMProvider(BaseLLMProvider):
    """
    OpenAI Chat Completion provider with streaming support.
    """

    API_URL = "https://api.openai.com/v1/chat/completions"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
    ):
        self.api_key = api_key if api_key is not None else getattr(settings, "OPENAI_API_KEY", "")
        self.model_name = model_name or "gpt-4o-mini"
        self.temperature = temperature if temperature is not None else getattr(settings, "LLM_TEMPERATURE", 0.2)
        self.max_tokens = max_tokens or getattr(settings, "LLM_MAX_TOKENS", 1024)
        self.timeout_seconds = timeout_seconds or getattr(settings, "LLM_TIMEOUT_SECONDS", 30)

        if not self.api_key:
            logger.warning("OpenAI API key is unset. OpenAILLMProvider calls will fail unless provided.")

    def _build_messages(self, system_prompt: str, user_prompt: str) -> list:
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
    ) -> LLMResponse:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is not configured in settings or environment.")

        payload = {
            "model": self.model_name,
            "messages": self._build_messages(system_prompt, user_prompt),
            "temperature": temperature if temperature is not None else self.temperature,
            "max_tokens": max_tokens or self.max_tokens,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        timeout = timeout_seconds or self.timeout_seconds

        t0 = time.perf_counter()
        try:
            response = requests.post(self.API_URL, json=payload, headers=headers, timeout=timeout)
        except requests.exceptions.Timeout:
            raise TimeoutError(f"OpenAI API timed out after {timeout} seconds.")
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Network error communicating with OpenAI: {str(e)}") from e

        latency_ms = int((time.perf_counter() - t0) * 1000)

        if response.status_code != 200:
            error_msg = f"OpenAI API error [{response.status_code}]: {response.text}"
            logger.error(error_msg)
            raise RuntimeError(error_msg)

        data = response.json()
        choices = data.get("choices", [])
        if not choices:
            raise ValueError(f"OpenAI returned no choices: {data}")

        content = choices[0].get("message", {}).get("content", "")
        usage = data.get("usage", {})

        return LLMResponse(
            content=content,
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
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
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is not configured in settings or environment.")

        payload = {
            "model": self.model_name,
            "messages": self._build_messages(system_prompt, user_prompt),
            "temperature": temperature if temperature is not None else self.temperature,
            "max_tokens": max_tokens or self.max_tokens,
            "stream": True,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        timeout = timeout_seconds or self.timeout_seconds

        try:
            with requests.post(self.API_URL, json=payload, headers=headers, stream=True, timeout=timeout) as response:
                if response.status_code != 200:
                    raise RuntimeError(f"OpenAI stream API error [{response.status_code}]: {response.text}")

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
                            choices = chunk_json.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {}).get("content", "")
                                if delta:
                                    yield delta
                        except json.JSONDecodeError:
                            continue
        except requests.exceptions.Timeout:
            raise TimeoutError(f"OpenAI stream timed out after {timeout} seconds.")
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Network error during OpenAI streaming: {str(e)}") from e

    def get_model_name(self) -> str:
        return self.model_name
