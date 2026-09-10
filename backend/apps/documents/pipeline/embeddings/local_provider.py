"""
Local Hugging Face Embedding Provider using FastEmbed (ONNX Runtime).
Runs entirely in-process on CPU without PyTorch.
Uses thread-safe lazy loading to preserve memory on boot.
Designed for resource-constrained environments (e.g. Render 512MB RAM).
"""
import logging
import threading
from typing import List, Optional
from django.conf import settings
from apps.documents.pipeline.embeddings.base import BaseEmbeddingProvider

logger = logging.getLogger(__name__)


class LocalFastEmbedProvider(BaseEmbeddingProvider):
    """
    Local Embedding Provider using FastEmbed (ONNX Runtime in C++).
    Downloads and caches Hugging Face models (default: BAAI/bge-small-en-v1.5).
    Zero PyTorch dependency ensures low memory footprint (~90MB).
    """

    _model = None
    _lock = threading.Lock()

    def __init__(
        self,
        model_name: str = "BAAI/bge-small-en-v1.5",
        dimensions: int = 384,
        cache_dir: Optional[str] = None,
        **kwargs,
    ):
        raw_name = model_name or getattr(settings, "EMBEDDING_MODEL_NAME", "BAAI/bge-small-en-v1.5")
        if raw_name in ["text-embedding-004", "text-embedding-3-small", "gemini-embedding-001", ""]:
            self.model_name = "BAAI/bge-small-en-v1.5"
        else:
            self.model_name = raw_name

        self.dimensions = dimensions or getattr(settings, "EMBEDDING_DIMENSIONS", 384)
        self.cache_dir = cache_dir

    @classmethod
    def _get_model(cls, model_name: str, cache_dir: Optional[str] = None):
        """
        Thread-safe lazy loader. Model is loaded only on the first call to embed.
        """
        if cls._model is None:
            with cls._lock:
                if cls._model is None:
                    logger.info("Initializing FastEmbed model '%s' (ONNX Runtime)...", model_name)
                    try:
                        from fastembed import TextEmbedding
                        cls._model = TextEmbedding(model_name=model_name, cache_dir=cache_dir)
                        logger.info("FastEmbed model '%s' loaded successfully.", model_name)
                    except Exception as e:
                        logger.error("Failed to load FastEmbed model '%s': %s", model_name, str(e), exc_info=True)
                        raise RuntimeError(f"Failed to load FastEmbed model '{model_name}': {str(e)}") from e
        return cls._model

    def embed_text(self, text: str) -> List[float]:
        """
        Embeds a single string into a float vector.
        """
        results = self.embed_batch([text])
        if not results:
            raise ValueError(f"FastEmbed returned empty vector for text: {text[:50]}...")
        return results[0]

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Embeds a batch of strings using FastEmbed ONNX runtime.
        Returns a list of normalized float vectors.
        """
        if not texts:
            return []

        model = self._get_model(self.model_name, self.cache_dir)
        try:
            # model.embed returns a generator of numpy.ndarray vectors
            embeddings = list(model.embed(texts))
            return [vec.tolist() for vec in embeddings]
        except Exception as e:
            logger.error("FastEmbed error during batch embedding: %s", str(e), exc_info=True)
            raise RuntimeError(f"FastEmbed embedding error: {str(e)}") from e

    def get_dimensions(self) -> int:
        return self.dimensions

    def get_model_name(self) -> str:
        return self.model_name
