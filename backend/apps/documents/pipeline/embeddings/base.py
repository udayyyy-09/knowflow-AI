"""
Abstract Base Class for Embedding Providers in KnowFlow AI.
"""
from abc import ABC, abstractmethod
from typing import List


class BaseEmbeddingProvider(ABC):
    """
    Interface definition for embedding providers.
    All embedding providers (OpenAI, Gemini, Mock, etc.) must implement this interface.
    """

    @abstractmethod
    def embed_text(self, text: str) -> List[float]:
        """
        Generates a normalized float vector embedding for a single text string.

        Args:
            text: Input string to embed.

        Returns:
            List[float]: Normalized vector representation.
        """
        pass

    @abstractmethod
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generates normalized float vector embeddings for a list of text strings in batch.

        Args:
            texts: List of text strings to embed.

        Returns:
            List[List[float]]: List of vector embeddings corresponding to the inputs.
        """
        pass

    @abstractmethod
    def get_dimensions(self) -> int:
        """
        Returns the dimensionality of the generated vectors.
        """
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        """
        Returns the identifier of the embedding model in use.
        """
        pass
