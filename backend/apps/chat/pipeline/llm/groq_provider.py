"""
Groq Cloud LLM Provider for KnowFlow AI.
Provides ultra-low latency, high-throughput inference on Llama 3.1 8B, Llama 3.3 70B, and Qwen 2.5 Coder.
"""
import json
import logging
import time
from typing import Iterator, List, Optional
import requests
from django.conf import settings

from apps.chat.pipeline.llm.base import BaseLLMProvider, LLMResponse

logger = logging.getLogger(__name__)


class GroqLLMProvider(BaseLLMProvider):
    """
    Groq Cloud Chat Completion provider using OpenAI-compatible format with streaming and fallback models.
    """

    API_URL = "https://api.groq.com/openai/v1/chat/completions"
    FALLBACK_MODELS = [
        "qwen/qwen3.8-27b",
        "groq/compound-mini",
        "openai/gpt-oss-20b",
        "llama-3.1-8b-instant",
    ]

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
    ):
        self.api_key = api_key if api_key is not None else getattr(settings, "GROQ_API_KEY", "")
        raw_model = model_name or getattr(settings, "GROQ_MODEL_NAME", "qwen/qwen3.8-27b")
        if not raw_model or raw_model.startswith("gemini") or "instruct" in raw_model.lower():
            self.model_name = "qwen/qwen3.8-27b"
        else:
            self.model_name = raw_model
        self.temperature = temperature if temperature is not None else getattr(settings, "LLM_TEMPERATURE", 0.2)
        self.max_tokens = max_tokens or getattr(settings, "LLM_MAX_TOKENS", 4096)
        self.timeout_seconds = timeout_seconds or getattr(settings, "LLM_TIMEOUT_SECONDS", 30)

        if not self.api_key:
            logger.warning("Groq API key is unset. GroqLLMProvider calls will fail unless provided.")

    def _get_models_to_try(self) -> List[str]:
        models = [self.model_name]
        for fb in self.FALLBACK_MODELS:
            if fb not in models:
                models.append(fb)
        return models

    def _build_payload(
        self,
        model: str,
        system_prompt: str,
        user_prompt: str,
        stream: bool = False,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> dict:
        return {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature if temperature is not None else self.temperature,
            "max_tokens": max_tokens or self.max_tokens,
            "stream": stream,
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
        Executes synchronous chat completion call with fallback retry.
        """
        if not self.api_key:
            raise ValueError("GROQ_API_KEY is not configured.")

        timeout = timeout_seconds or self.timeout_seconds
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        last_error = None

        for model_to_try in self._get_models_to_try():
            payload = self._build_payload(
                model=model_to_try,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                stream=False,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            t0 = time.perf_counter()
            try:
                response = requests.post(
                    self.API_URL,
                    json=payload,
                    headers=headers,
                    timeout=timeout,
                )
                latency_ms = int((time.perf_counter() - t0) * 1000)

                if response.status_code == 200:
                    data = response.json()
                    choices = data.get("choices", [])
                    if not choices:
                        raise ValueError("Empty choices returned from Groq API.")

                    content = choices[0].get("message", {}).get("content", "")
                    usage = data.get("usage", {})
                    prompt_tokens = usage.get("prompt_tokens", len(user_prompt) // 4)
                    completion_tokens = usage.get("completion_tokens", len(content) // 4)
                    total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens)

                    return LLMResponse(
                        content=content,
                        model_name=model_to_try,
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens,
                        total_tokens=total_tokens,
                        latency_ms=latency_ms,
                    )
                elif response.status_code in [429, 503, 504, 404]:
                    logger.warning(
                        "Groq model '%s' returned status %d. Trying fallback...",
                        model_to_try,
                        response.status_code,
                    )
                    last_error = RuntimeError(f"Groq API error [{response.status_code}]: {response.text}")
                    continue
                else:
                    error_msg = f"Groq API error [{response.status_code}]: {response.text}"
                    logger.error(error_msg)
                    raise RuntimeError(error_msg)

            except (requests.exceptions.Timeout, requests.exceptions.RequestException) as e:
                logger.warning("Network error with Groq model '%s': %s", model_to_try, str(e))
                last_error = e
                continue

        if last_error:
            raise last_error
        raise RuntimeError("All Groq model endpoints failed.")

    def generate_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
    ) -> Iterator[str]:
        """
        Streams tokens from Groq using SSE stream=True with model fallbacks.
        """
        if not self.api_key:
            raise ValueError("GROQ_API_KEY is not configured.")

        timeout = timeout_seconds or self.timeout_seconds
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        last_error = None

        for model_to_try in self._get_models_to_try():
            payload = self._build_payload(
                model=model_to_try,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                stream=True,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            try:
                with requests.post(
                    self.API_URL,
                    json=payload,
                    headers=headers,
                    stream=True,
                    timeout=timeout,
                ) as response:
                    if response.status_code == 200:
                        has_yielded = False
                        for line in response.iter_lines():
                            if not line:
                                continue
                            line_str = line.decode("utf-8")
                            if line_str.startswith("data: "):
                                data_str = line_str[6:].strip()
                                if data_str == "[DONE]":
                                    break
                                try:
                                    chunk = json.loads(data_str)
                                    choices = chunk.get("choices", [])
                                    if choices:
                                        delta = choices[0].get("delta", {})
                                        text_delta = delta.get("content", "")
                                        if text_delta:
                                            has_yielded = True
                                            yield text_delta
                                except json.JSONDecodeError:
                                    continue
                        if has_yielded:
                            return
                    elif response.status_code in [429, 503, 504, 404]:
                        logger.warning(
                            "Groq stream for '%s' returned status %d. Trying fallback...",
                            model_to_try,
                            response.status_code,
                        )
                        last_error = RuntimeError(f"Groq stream error [{response.status_code}]: {response.text}")
                        continue
                    else:
                        error_msg = f"Groq stream error [{response.status_code}]: {response.text}"
                        logger.error(error_msg)
                        raise RuntimeError(error_msg)

            except (requests.exceptions.Timeout, requests.exceptions.RequestException) as e:
                logger.warning("Groq stream connection error with model '%s': %s", model_to_try, str(e))
                last_error = e
                continue

        if last_error:
            raise last_error
        raise RuntimeError("All Groq stream model endpoints failed.")

    def get_model_name(self) -> str:
        return self.model_name
