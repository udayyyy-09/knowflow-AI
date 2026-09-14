"""
Factory for creating and managing Embedding Provider instances in KnowFlow AI.
"""
import logging
from typing import Dict, Optional
from django.conf import settings

from apps.documents.pipeline.embeddings.base import BaseEmbeddingProvider
from apps.documents.pipeline.embeddings.huggingface_provider import HuggingFaceEmbeddingProvider
from apps.documents.pipeline.embeddings.openai_provider import OpenAIEmbeddingProvider
from apps.documents.pipeline.embeddings.gemini_provider import GeminiEmbeddingProvider
from apps.documents.pipeline.embeddings.mock_provider import MockEmbeddingProvider
from apps.documents.pipeline.embeddings.local_provider import LocalFastEmbedProvider

logger = logging.getLogger(__name__)


class EmbeddingProviderFactory:
    """
    Factory to retrieve configured embedding provider singletons.
    """
    _instances: Dict[str, BaseEmbeddingProvider] = {}

    @classmethod
    def get_provider(
        cls,
        provider_name: Optional[str] = None,
        model_name: Optional[str] = None,
        dimensions: Optional[int] = None,
        force_new: bool = False,
    ) -> BaseEmbeddingProvider:
        """
        Returns an embedding provider instance matching the specified or configured provider.

        Args:
            provider_name: 'huggingface', 'gemini', 'local', 'openai', or 'mock'. Defaults to settings.EMBEDDING_PROVIDER.
            model_name: Model identifier. Defaults to settings.EMBEDDING_MODEL_NAME.
            dimensions: Vector dimension. Defaults to settings.EMBEDDING_DIMENSIONS.
            force_new: If True, bypasses cache and instantiates a new provider.

        Returns:
            BaseEmbeddingProvider: An initialized embedding provider.
        """
        selected_provider = (provider_name or getattr(settings, "EMBEDDING_PROVIDER", "gemini")).lower()
        selected_model = model_name or getattr(settings, "EMBEDDING_MODEL_NAME", "text-embedding-004")
        selected_dimensions = dimensions or getattr(settings, "EMBEDDING_DIMENSIONS", 768)

        cache_key = f"{selected_provider}:{selected_model}:{selected_dimensions}"

        if not force_new and cache_key in cls._instances:
            return cls._instances[cache_key]

        if selected_provider in ["huggingface", "hf"]:
            hf_model = selected_model if selected_model not in ["text-embedding-004", "text-embedding-3-small"] else "BAAI/bge-small-en-v1.5"
            provider = HuggingFaceEmbeddingProvider(
                model_name=hf_model,
                dimensions=selected_dimensions if selected_dimensions != 768 else 384,
            )
        elif selected_provider == "gemini":
            gemini_model = selected_model if selected_model != "BAAI/bge-small-en-v1.5" else "text-embedding-004"
            provider = GeminiEmbeddingProvider(
                model_name=gemini_model,
                dimensions=selected_dimensions,
            )
        elif selected_provider == "openai":
            provider = OpenAIEmbeddingProvider(
                model_name=selected_model,
                dimensions=selected_dimensions,
            )
        elif selected_provider in ["local", "fastembed"]:
            local_model = selected_model
            if local_model in ["text-embedding-004", "text-embedding-3-small", "gemini-embedding-001", ""]:
                local_model = "BAAI/bge-small-en-v1.5"
            local_dims = selected_dimensions if selected_dimensions != 1536 else 384
            provider = LocalFastEmbedProvider(
                model_name=local_model,
                dimensions=local_dims,
            )
        elif selected_provider == "mock":
            provider = MockEmbeddingProvider(
                model_name=selected_model,
                dimensions=selected_dimensions,
            )
        else:
            raise ValueError(
                f"Unsupported embedding provider: '{selected_provider}'. "
                f"Supported providers are 'huggingface', 'gemini', 'local', 'openai', 'mock'."
            )

        cls._instances[cache_key] = provider
        return provider

    @classmethod
    def clear_cache(cls):
        """Clears all cached provider instances (useful for testing)."""
        cls._instances.clear()
