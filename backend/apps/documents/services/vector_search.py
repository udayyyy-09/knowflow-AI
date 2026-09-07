"""
Vector Similarity Search Service for KnowFlow AI.
Performs multi-tenant semantic retrieval across document chunk embeddings using pgvector cosine distance.
"""
import logging
import math
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from django.db import connection
from pgvector.django import CosineDistance

from apps.workspaces.models import Workspace
from apps.documents.models import Embedding
from apps.documents.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """
    Structured container for a semantic search result item with citations.
    """
    chunk_id: str
    chunk_index: int
    content: str
    page_number: Optional[int]
    section_header: str
    metadata: Dict[str, Any]
    document_id: str
    document_title: str
    version_id: str
    version_number: int
    similarity_score: float
    cosine_distance: float


class VectorSearchService:
    """
    Executes vector cosine similarity searches scoped to workspace tenant boundaries.
    """

    def __init__(self, embedding_service: Optional[EmbeddingService] = None):
        self.embedding_service = embedding_service or EmbeddingService()

    def search(
        self,
        workspace: Workspace,
        query_text: str,
        top_k: int = 5,
        min_score: float = 0.0,
        document_ids: Optional[List[str]] = None,
    ) -> List[SearchResult]:
        """
        Executes semantic vector search for a query in a specific workspace.

        Args:
            workspace: Target workspace (strict tenant boundary).
            query_text: Natural language user query.
            top_k: Maximum number of relevant chunks to return (default 5).
            min_score: Minimum cosine similarity threshold [0.0 - 1.0].
            document_ids: Optional list of document UUIDs to restrict the search.

        Returns:
            List[SearchResult]: Ranked list of relevant chunks with citations and similarity scores.
        """
        if not query_text or not query_text.strip():
            return []

        # 1. Generate query embedding vector
        query_vector = self.embedding_service.generate_query_embedding(query_text)

        # 2. Build base query restricted to workspace and active content
        base_queryset = (
            Embedding.objects.filter(
                workspace=workspace,
                is_active=True,
                document__is_active=True,
                chunk__version__is_active=True,
            )
            .select_related('chunk', 'chunk__version', 'document')
        )

        if document_ids:
            base_queryset = base_queryset.filter(document_id__in=document_ids)

        # 3. Retrieve candidates
        if connection.vendor == 'postgresql':
            queryset = (
                base_queryset
                .annotate(distance=CosineDistance('vector', query_vector))
                .order_by('distance')
            )
            candidates = list(queryset[:top_k])
        else:
            # For non-Postgres environments (e.g. SQLite tests), calculate cosine distance
            all_embs = list(base_queryset)

            def get_distance(emb):
                vec = emb.vector
                if not vec:
                    return 2.0
                dot = sum(a * b for a, b in zip(vec, query_vector))
                norm_a = math.sqrt(sum(a * a for a in vec))
                norm_b = math.sqrt(sum(b * b for b in query_vector))
                if norm_a == 0 or norm_b == 0:
                    return 2.0
                sim = dot / (norm_a * norm_b)
                return max(0.0, 1.0 - sim)

            all_embs.sort(key=get_distance)
            candidates = all_embs[:top_k]
            for emb in candidates:
                setattr(emb, 'distance', get_distance(emb))


        results: List[SearchResult] = []
        for emb in candidates:
            # Cosine distance d in [0, 2]; similarity score s = 1.0 - d (clipped to [0.0, 1.0])
            distance = float(getattr(emb, 'distance', 0.0))
            score = max(0.0, min(1.0, 1.0 - distance))

            if score < min_score:
                continue

            chunk = emb.chunk
            doc = emb.document
            version = chunk.version

            results.append(
                SearchResult(
                    chunk_id=str(chunk.id),
                    chunk_index=chunk.chunk_index,
                    content=chunk.content,
                    page_number=chunk.page_number,
                    section_header=chunk.section_header,
                    metadata=chunk.metadata or {},
                    document_id=str(doc.id),
                    document_title=doc.title,
                    version_id=str(version.id),
                    version_number=version.version_number,
                    similarity_score=round(score, 4),
                    cosine_distance=round(distance, 4),
                )
            )

        logger.info(
            "Vector search for '%s' in workspace '%s' returned %d results (top_k=%d, min_score=%.2f)",
            query_text[:40], workspace.name, len(results), top_k, min_score
        )
        return results
