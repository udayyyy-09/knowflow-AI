"""
Celery asynchronous tasks for Document Processing & Embedding Pipeline.
"""
import logging
from celery import shared_task
from apps.documents.services.ingestion import DocumentIngestionService
from apps.documents.services.embedding_service import EmbeddingService
from apps.documents.models import Document, DocumentVersion, DocumentChunk, DocumentStatus
from apps.workspaces.models import Workspace

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name="apps.documents.tasks.process_document_version",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
)
def process_document_version(self, version_id: str):
    """
    Asynchronous task to parse, extract, chunk, and embed an uploaded DocumentVersion.
    """
    logger.info("Starting processing task for DocumentVersion id=%s (task_id=%s)", version_id, self.request.id)

    try:
        service = DocumentIngestionService()
        chunks = service.process_version(version_id)
        return {
            "version_id": str(version_id),
            "chunks_count": len(chunks),
            "status": "SUCCESS"
        }
    except Exception as exc:
        logger.error("Error processing DocumentVersion %s: %s", version_id, exc)
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            logger.critical("Max retries exceeded for DocumentVersion %s.", version_id)
            return {
                "version_id": str(version_id),
                "status": "FAILED",
                "error": str(exc)
            }


@shared_task(
    bind=True,
    name="apps.documents.tasks.reembed_document_version",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
)
def reembed_document_version(self, version_id: str):
    """
    Asynchronously regenerates embeddings for all existing chunks in a DocumentVersion.
    """
    logger.info("Starting re-embedding task for DocumentVersion id=%s", version_id)
    try:
        version = DocumentVersion.objects.get(id=version_id)
        chunks = list(DocumentChunk.objects.filter(version=version).order_by('chunk_index'))
        if not chunks:
            logger.warning("No chunks found for DocumentVersion %s to re-embed.", version_id)
            return {"version_id": str(version_id), "embeddings_count": 0, "status": "SUCCESS"}

        embedding_service = EmbeddingService()
        embeddings = embedding_service.generate_embeddings_for_chunks(chunks)
        return {
            "version_id": str(version_id),
            "embeddings_count": len(embeddings),
            "status": "SUCCESS"
        }
    except Exception as exc:
        logger.error("Error re-embedding DocumentVersion %s: %s", version_id, exc)
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            return {"version_id": str(version_id), "status": "FAILED", "error": str(exc)}


@shared_task(
    bind=True,
    name="apps.documents.tasks.reembed_workspace",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
)
def reembed_workspace(self, workspace_id: str):
    """
    Asynchronously re-embeds all active document versions in a workspace.
    """
    logger.info("Starting re-embedding task for Workspace id=%s", workspace_id)
    try:
        workspace = Workspace.objects.get(id=workspace_id)
        active_versions = DocumentVersion.objects.filter(
            document__workspace=workspace,
            document__is_active=True,
            is_active=True
        )
        total_embedded = 0
        embedding_service = EmbeddingService()

        for version in active_versions:
            chunks = list(DocumentChunk.objects.filter(version=version).order_by('chunk_index'))
            if chunks:
                embs = embedding_service.generate_embeddings_for_chunks(chunks)
                total_embedded += len(embs)

        return {
            "workspace_id": str(workspace_id),
            "total_embeddings": total_embedded,
            "status": "SUCCESS"
        }
    except Exception as exc:
        logger.error("Error re-embedding Workspace %s: %s", workspace_id, exc)
        return {"workspace_id": str(workspace_id), "status": "FAILED", "error": str(exc)}
