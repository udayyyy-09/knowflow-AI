"""
Hugging Face Serverless Embeddings Provider for KnowFlow AI.
Provides free, high-performance vector embeddings via BAAI/bge-small-en-v1.5 and all-MiniLM-L6-v2.
"""
import logging
import requests
from typing import List, Optional
from django.conf import settings
from apps.documents.pipeline.embeddings.base import BaseEmbeddingProvider

logger = logging.getLogger(__name__)


class HuggingFaceEmbeddingProvider(BaseEmbeddingProvider):
    """
    Hugging Face Serverless feature extraction embeddings provider.
    """

    API_BASE = "https://api-inference.huggingface.co/models"
    DEFAULT_MODEL = "BAAI/bge-small-en-v1.5"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        dimensions: int = 384,
        timeout_seconds: int = 30,
    ):
        self.api_key = api_key if api_key is not None else getattr(settings, "HUGGINGFACE_API_KEY", "")
        self.model_name = model_name or getattr(settings, "EMBEDDING_MODEL_NAME", self.DEFAULT_MODEL)
        self.dimensions = dimensions or getattr(settings, "EMBEDDING_DIMENSIONS", 384)
        self.timeout_seconds = timeout_seconds or getattr(settings, "EMBEDDING_TIMEOUT_SECONDS", 30)

        if not self.api_key:
            logger.warning("Hugging Face API key is not configured. HuggingFaceEmbeddingProvider calls will fail unless provided.")

    def embed_text(self, text: str) -> List[float]:
        """
        Embeds a single string into a dense float vector.
        """
        results = self.embed_batch([text])
        if not results:
            raise ValueError(f"Hugging Face embedding returned empty vector for text: {text[:50]}...")
        return results[0]

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Embeds a batch of texts using Hugging Face feature extraction endpoint.
        """
        if not texts:
            return []

        if not self.api_key:
            raise ValueError("HUGGINGFACE_API_KEY is not configured.")

        url = f"{self.API_BASE}/{self.model_name}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        # Hugging Face Feature Extraction accepts single text or array of texts
        clean_texts = [t if t and t.strip() else " " for t in texts]
        payload = {
            "inputs": clean_texts,
            "options": {"wait_for_model": True},
        }

        try:
            response = requests.post(
                url,
                json=payload,
                headers=headers,
                timeout=self.timeout_seconds,
            )

            if response.status_code == 200:
                data = response.json()
                # If single string or nested array returned
                if isinstance(data, list):
                    # Check if 2D list or 1D list
                    if len(data) > 0 and isinstance(data[0], list):
                        # Could be batch embeddings or token embeddings (mean pooling if 3D)
                        if len(data[0]) > 0 and isinstance(data[0][0], list):
                            # 3D tensor: [batch_size, seq_len, hidden_dim] -> mean pool over seq_len
                            pooled = []
                            for doc_tokens in data:
                                if not doc_tokens:
                                    continue
                                dim = len(doc_tokens[0])
                                mean_vec = [sum(doc_tokens[t][d] for t in range(len(doc_tokens))) / len(doc_tokens) for d in range(dim)]
                                pooled.append(mean_vec)
                            return pooled
                        return data
                    elif len(data) > 0 and isinstance(data[0], (int, float)):
                        return [data]
                return data
            else:
                error_msg = (
                    f"Hugging Face Embeddings error [{response.status_code}] for model '{self.model_name}': "
                    f"{response.text}"
                )
                logger.error(error_msg)
                raise RuntimeError(error_msg)

        except requests.exceptions.RequestException as exc:
            error_msg = f"Hugging Face Embeddings network error for model '{self.model_name}': {exc}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from exc

    def get_dimensions(self) -> int:
        return self.dimensions

    def get_model_name(self) -> str:
        return self.model_name
