"""
Multi-Tier Cascading LLM Provider for KnowFlow AI.
Orchestrates seamless fallback:
  Tier 1: Hugging Face Serverless API (Llama 3.1 8B, Qwen 2.5)
  Tier 2: Groq Cloud (Llama 3.1 8B Instant, Llama 3.3 70B)
  Tier 3: Google Gemini (Gemini 2.0 Flash, Gemini 1.5 Flash)
"""
import logging
from typing import Iterator, List, Optional
from django.conf import settings

from apps.chat.pipeline.llm.base import BaseLLMProvider, LLMResponse
from apps.chat.pipeline.llm.huggingface_provider import HuggingFaceLLMProvider
from apps.chat.pipeline.llm.groq_provider import GroqLLMProvider
from apps.chat.pipeline.llm.gemini_provider import GeminiLLMProvider

logger = logging.getLogger(__name__)


class CascadingLLMProvider(BaseLLMProvider):
    """
    Tries Tier 1 (Hugging Face) -> Tier 2 (Groq) -> Tier 3 (Google Gemini) sequentially.
    Ensures maximum uptime, resilience against free-tier rate limits, and zero user disruption.
    """

    def __init__(
        self,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
    ):
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout_seconds = timeout_seconds

        # Instantiate available providers
        self.hf_provider = HuggingFaceLLMProvider(
            temperature=temperature,
            max_tokens=max_tokens,
            timeout_seconds=timeout_seconds or 25,
        )
        self.groq_provider = GroqLLMProvider(
            temperature=temperature,
            max_tokens=max_tokens,
            timeout_seconds=timeout_seconds or 25,
        )
        self.gemini_provider = GeminiLLMProvider(
            temperature=temperature,
            max_tokens=max_tokens,
            timeout_seconds=timeout_seconds or 35,
        )

        self._active_model_name = "cascade(groq->gemini->hf)"

    def _get_tier_pipeline(self) -> List[tuple]:
        """
        Returns list of (tier_name, provider_instance) in priority order:
        Tier 1: Groq Cloud API (Sub-200ms ultra-low latency)
        Tier 2: Google Gemini API (High-quality contextual reasoning)
        Tier 3: Hugging Face Serverless API (Fallback open-weights)
        """
        return [
            ("Groq Cloud (Tier 1)", self.groq_provider),
            ("Google Gemini (Tier 2)", self.gemini_provider),
            ("Hugging Face (Tier 3)", self.hf_provider),
        ]

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
    ) -> LLMResponse:
        """
        Executes synchronous completion across tiers in cascade order.
        """
        tiers = self._get_tier_pipeline()
        last_error = None

        for tier_name, provider in tiers:
            try:
                logger.info("Attempting LLM generation with %s...", tier_name)
                response = provider.generate(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout_seconds=timeout_seconds,
                )
                self._active_model_name = f"{tier_name}:{response.model_name}"
                logger.info("LLM generation succeeded with %s (%s)", tier_name, response.model_name)
                return response
            except Exception as exc:
                logger.warning(
                    "%s failed (error: %s). Cascading to next available provider...",
                    tier_name,
                    str(exc),
                )
                last_error = exc
                continue

        if last_error:
            raise last_error
        raise RuntimeError("All cascading LLM tiers (HuggingFace -> Groq -> Gemini) failed.")

    def generate_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
    ) -> Iterator[str]:
        """
        Executes streaming token generation across tiers with failover before token delivery.
        """
        tiers = self._get_tier_pipeline()
        last_error = None

        for tier_name, provider in tiers:
            try:
                logger.info("Attempting LLM streaming with %s...", tier_name)
                has_yielded = False
                stream_iter = provider.generate_stream(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout_seconds=timeout_seconds,
                )

                for token in stream_iter:
                    has_yielded = True
                    yield token

                if has_yielded:
                    self._active_model_name = f"{tier_name}:{provider.get_model_name()}"
                    logger.info("LLM streaming completed cleanly via %s", tier_name)
                    return

            except Exception as exc:
                logger.warning(
                    "%s streaming failed (error: %s). Cascading to next tier...",
                    tier_name,
                    str(exc),
                )
                last_error = exc
                continue

        if last_error:
            raise last_error
        raise RuntimeError("All cascading LLM tiers (HuggingFace -> Groq -> Gemini) stream failed.")

    def get_model_name(self) -> str:
        return self._active_model_name
