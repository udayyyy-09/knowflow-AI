"""
Google Gemini Embedding Provider implementation.
Connects to Google's Generative Language API (e.g. gemini-embedding-001).
"""
import logging
import requests
from typing import List
from django.conf import settings
from apps.documents.pipeline.embeddings.base import BaseEmbeddingProvider

logger = logging.getLogger(__name__)


class GeminiEmbeddingProvider(BaseEmbeddingProvider):
    """
    Google Gemini Embeddings provider via REST API without retry loops.
    Fails fast with detailed error logging for auditability and error tracing.
    """

    API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

    def __init__(
        self,
        api_key: str = None,
        model_name: str = "gemini-embedding-001",
        dimensions: int = 768,
        timeout_seconds: int = 30,
    ):
        self.api_key = api_key if api_key is not None else getattr(settings, "GEMINI_API_KEY", "")
        # Normalize model name: Google v1beta uses 'gemini-embedding-001'
        raw_name = model_name or getattr(settings, "EMBEDDING_MODEL_NAME", "gemini-embedding-001")
        cleaned = raw_name.replace("models/", "").strip()
        if not cleaned or cleaned in ["text-embedding-004", "embedding-001", "text-embedding-3-small", "default"]:
            self.model_name = "gemini-embedding-001"
        else:
            self.model_name = cleaned
        self.dimensions = dimensions or getattr(settings, "EMBEDDING_DIMENSIONS", 768)
        self.timeout_seconds = timeout_seconds or getattr(settings, "EMBEDDING_TIMEOUT_SECONDS", 30)

        if not self.api_key:
            logger.warning("Gemini API key is not configured. GeminiEmbeddingProvider calls will fail unless provided.")

    def embed_text(self, text: str) -> List[float]:
        """
        Embeds a single string into a vector.
        """
        results = self.embed_batch([text])
        if not results:
            raise ValueError(f"Gemini embedding returned empty vector for text: {text[:50]}...")
        return results[0]

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Embeds a batch of texts using Gemini embedContent API.
        Fails immediately on error with precise diagnostic logging.
        """
        if not texts:
            return []

        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured in settings or environment.")

        url = f"{self.API_BASE}/{self.model_name}:embedContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        results: List[List[float]] = []

        for text in texts:
            sanitized_text = text if text and text.strip() else " "
            payload = {
                "model": f"models/{self.model_name}",
                "content": {"parts": [{"text": sanitized_text}]},
            }
            if self.dimensions:
                payload["outputDimensionality"] = self.dimensions

            try:
                response = requests.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=self.timeout_seconds,
                )

                if response.status_code == 200:
                    data = response.json()
                    values = data.get("embedding", {}).get("values", [])
                    results.append(values)
                else:
                    error_msg = (
                        f"Gemini Embeddings API error [{response.status_code}] for model '{self.model_name}': "
                        f"{response.text}"
                    )
                    logger.error(error_msg)
                    raise RuntimeError(error_msg)

            except requests.exceptions.RequestException as exc:
                error_msg = f"Gemini Embeddings network/connection error for model '{self.model_name}': {exc}"
                logger.error(error_msg)
                raise RuntimeError(error_msg) from exc

        return results

    def get_dimensions(self) -> int:
        return self.dimensions

    def get_model_name(self) -> str:
        return self.model_name
