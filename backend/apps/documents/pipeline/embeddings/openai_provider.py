"""
OpenAI Embedding Provider implementation.
Connects to OpenAI's Embeddings API (e.g. text-embedding-3-small, text-embedding-3-large).
"""
import logging
import requests
from typing import List
from django.conf import settings
from apps.documents.pipeline.embeddings.base import BaseEmbeddingProvider

logger = logging.getLogger(__name__)


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    """
    OpenAI API embedding provider using requests without retry loops.
    Fails fast with detailed error logging for auditability and error tracing.
    """

    API_URL = "https://api.openai.com/v1/embeddings"

    # Default dimensions per model
    MODEL_DIMENSIONS = {
        "text-embedding-3-small": 1536,
        "text-embedding-3-large": 3072,
        "text-embedding-ada-002": 1536,
    }

    def __init__(
        self,
        api_key: str = None,
        model_name: str = "text-embedding-3-small",
        dimensions: int = None,
        timeout_seconds: int = 30,
    ):
        self.api_key = api_key if api_key is not None else getattr(settings, "OPENAI_API_KEY", "")
        self.model_name = model_name
        self.dimensions = dimensions or self.MODEL_DIMENSIONS.get(model_name, 1536)
        self.timeout_seconds = timeout_seconds or getattr(settings, "EMBEDDING_TIMEOUT_SECONDS", 30)

        if not self.api_key:
            logger.warning("OpenAI API key is not configured. OpenAIEmbeddingProvider calls will fail unless provided.")

    def embed_text(self, text: str) -> List[float]:
        """
        Embeds a single string into a vector.
        """
        results = self.embed_batch([text])
        if not results:
            raise ValueError(f"OpenAI embedding returned empty vector for text: {text[:50]}...")
        return results[0]

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Embeds a batch of texts using OpenAI Embeddings API.
        Fails immediately on error with precise diagnostic logging.
        """
        if not texts:
            return []

        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is not configured in settings or environment.")

        # Replace empty strings with a single space as OpenAI requires non-empty strings
        sanitized_texts = [t if t and t.strip() else " " for t in texts]

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "input": sanitized_texts,
            "model": self.model_name,
            "encoding_format": "float",
        }
        if "text-embedding-3" in self.model_name and self.dimensions:
            payload["dimensions"] = self.dimensions

        try:
            response = requests.post(
                self.API_URL,
                json=payload,
                headers=headers,
                timeout=self.timeout_seconds,
            )

            if response.status_code == 200:
                data = response.json()
                items = sorted(data.get("data", []), key=lambda x: x.get("index", 0))
                return [item["embedding"] for item in items]
            else:
                error_msg = (
                    f"OpenAI Embeddings API error [{response.status_code}] for model '{self.model_name}': "
                    f"{response.text}"
                )
                logger.error(error_msg)
                raise RuntimeError(error_msg)

        except requests.exceptions.RequestException as exc:
            error_msg = f"OpenAI Embeddings network/connection error for model '{self.model_name}': {exc}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from exc

    def get_dimensions(self) -> int:
        return self.dimensions

    def get_model_name(self) -> str:
        return self.model_name
