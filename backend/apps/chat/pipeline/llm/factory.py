"""
Factory for creating and managing LLM Provider instances.
"""
import logging
from typing import Dict, Optional
from django.conf import settings

from apps.chat.pipeline.llm.base import BaseLLMProvider
from apps.chat.pipeline.llm.cascading_provider import CascadingLLMProvider
from apps.chat.pipeline.llm.huggingface_provider import HuggingFaceLLMProvider
from apps.chat.pipeline.llm.groq_provider import GroqLLMProvider
from apps.chat.pipeline.llm.gemini_provider import GeminiLLMProvider
from apps.chat.pipeline.llm.openai_provider import OpenAILLMProvider
from apps.chat.pipeline.llm.mock_provider import MockLLMProvider

logger = logging.getLogger(__name__)


class LLMProviderFactory:
    """
    Singleton factory for resolving configured LLM providers.
    """

    _instances: Dict[str, BaseLLMProvider] = {}

    @classmethod
    def get_provider(
        cls,
        provider_name: Optional[str] = None,
        model_name: Optional[str] = None,
        force_new: bool = False,
    ) -> BaseLLMProvider:
        selected_provider = (provider_name or getattr(settings, "LLM_PROVIDER", "cascade")).lower()
        selected_model = model_name or getattr(settings, "LLM_MODEL_NAME", "meta-llama/Llama-3.1-8b-instruct")

        cache_key = f"{selected_provider}:{selected_model}"

        if not force_new and cache_key in cls._instances:
            return cls._instances[cache_key]

        if selected_provider in ["cascade", "cascading", "multi"]:
            provider = CascadingLLMProvider()
        elif selected_provider in ["huggingface", "hf"]:
            provider = HuggingFaceLLMProvider(model_name=selected_model)
        elif selected_provider in ["groq", "groqcloud"]:
            provider = GroqLLMProvider(model_name=selected_model)
        elif selected_provider == "gemini":
            provider = GeminiLLMProvider(model_name=selected_model)
        elif selected_provider == "openai":
            provider = OpenAILLMProvider(model_name=selected_model)
        elif selected_provider == "mock":
            provider = MockLLMProvider(model_name=selected_model)
        else:
            raise ValueError(
                f"Unsupported LLM provider: '{selected_provider}'. "
                f"Supported providers are 'cascade', 'huggingface', 'groq', 'gemini', 'openai', 'mock'."
            )

        cls._instances[cache_key] = provider
        return provider

    @classmethod
    def clear_cache(cls):
        cls._instances.clear()

