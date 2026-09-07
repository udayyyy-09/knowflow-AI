import hashlib
import math
import random
from typing import List
from apps.documents.pipeline.embeddings.base import BaseEmbeddingProvider


class MockEmbeddingProvider(BaseEmbeddingProvider):
    """
    Generates deterministic, unit-normalized embeddings based on text hash and tokens.
    Guarantees consistent vectors without network calls or external dependencies,
    suitable for testing and CI.
    """

    def __init__(self, dimensions: int = 1536, model_name: str = "mock-embedding-v1"):
        self.dimensions = dimensions
        self.model_name = model_name

    def embed_text(self, text: str) -> List[float]:
        """
        Embeds a single string into a normalized unit vector.
        """
        if not text or not text.strip():
            vec = [0.0] * self.dimensions
            vec[0] = 1.0
            return vec

        cleaned = text.strip().lower()
        seed = int(hashlib.sha256(cleaned.encode('utf-8')).hexdigest()[:8], 16)
        rng = random.Random(seed)

        # Base pseudo-random vector from text hash
        raw_vec = [rng.gauss(0, 1) for _ in range(self.dimensions)]

        # Add signal based on individual words
        words = cleaned.split()
        for word in words:
            word_seed = int(hashlib.md5(word.encode('utf-8')).hexdigest()[:8], 16)
            w_rng = random.Random(word_seed)
            for i in range(self.dimensions):
                raw_vec[i] += 0.5 * w_rng.gauss(0, 1)

        # L2 normalize
        sum_sq = sum(x * x for x in raw_vec)
        norm = math.sqrt(sum_sq)
        if norm > 0:
            return [round(x / norm, 6) for x in raw_vec]
        
        fallback = [0.0] * self.dimensions
        fallback[0] = 1.0
        return fallback

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Embeds a batch of texts.
        """
        return [self.embed_text(t) for t in texts]

    def get_dimensions(self) -> int:
        return self.dimensions

    def get_model_name(self) -> str:
        return self.model_name
