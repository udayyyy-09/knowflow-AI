"""
Embedding Generation Service for KnowFlow AI.
Coordinates batching, provider communication, and persistence of vector embeddings.
"""
import logging
from typing import List, Optional
from django.db import transaction
from django.conf import settings

from apps.documents.models import DocumentChunk, Embedding
from apps.documents.pipeline.embeddings.factory import EmbeddingProviderFactory
from apps.documents.pipeline.embeddings.base import BaseEmbeddingProvider

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    High-level service for generating and storing vector embeddings for DocumentChunk records
    and search queries.
    """

    def __init__(self, provider: Optional[BaseEmbeddingProvider] = None, batch_size: Optional[int] = None):
        self.provider = provider or EmbeddingProviderFactory.get_provider()
        self.batch_size = batch_size or getattr(settings, "EMBEDDING_BATCH_SIZE", 64)

    def generate_embeddings_for_chunks(self, chunks: List[DocumentChunk]) -> List[Embedding]:
        """
        Generates and atomically persists vector embeddings for a list of DocumentChunk instances.

        Args:
            chunks: List of DocumentChunk records to embed.

        Returns:
            List[Embedding]: List of created Embedding model instances.
        """
        if not chunks:
            return []

        logger.info("Starting embedding generation for %d chunks using provider %s...", len(chunks), self.provider.get_model_name())

        # Extract texts from chunks
        texts = [chunk.content for chunk in chunks]
        all_vectors: List[List[float]] = []

        # Batch texts to respect provider rate/batch limits
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i : i + self.batch_size]
            batch_vectors = self.provider.embed_batch(batch)
            all_vectors.extend(batch_vectors)

        if len(all_vectors) != len(chunks):
            raise ValueError(
                f"Embedding count mismatch: expected {len(chunks)} embeddings, got {len(all_vectors)} from provider."
            )

        model_name = self.provider.get_model_name()
        dimensions = self.provider.get_dimensions()

        embedding_instances = [
            Embedding(
                chunk=chunk,
                document=chunk.document,
                workspace=chunk.workspace,
                vector=vector,
                model_name=model_name,
                dimensions=dimensions,
                is_active=True,
            )
            for chunk, vector in zip(chunks, all_vectors)
        ]

        with transaction.atomic():
            # Delete any previous embeddings for these chunks to ensure clean idempotency
            chunk_ids = [chunk.id for chunk in chunks]
            Embedding.objects.filter(chunk_id__in=chunk_ids).delete()

            created_embeddings = Embedding.objects.bulk_create(embedding_instances)

        logger.info(
            "Successfully created and persisted %d embeddings for document version.",
            len(created_embeddings)
        )
        return created_embeddings

    def generate_query_embedding(self, query_text: str) -> List[float]:
        """
        Generates a normalized float vector for a search query string.

        Args:
            query_text: User search/question query.

        Returns:
            List[float]: Normalized vector representation.
        """
        if not query_text or not query_text.strip():
            raise ValueError("Query text cannot be empty for embedding generation.")
        return self.provider.embed_text(query_text.strip())
