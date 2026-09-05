"""
Celery asynchronous tasks for Document Processing Pipeline.
"""
import logging
from celery import shared_task
from apps.documents.services.ingestion import DocumentIngestionService
from apps.documents.models import DocumentVersion, DocumentStatus

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
    Asynchronous task to parse, extract, and chunk an uploaded DocumentVersion.
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
            # Retry if recoverable
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            logger.critical("Max retries exceeded for DocumentVersion %s.", version_id)
            return {
                "version_id": str(version_id),
                "status": "FAILED",
                "error": str(exc)
            }
