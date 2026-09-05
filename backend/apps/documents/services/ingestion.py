"""
Document Ingestion & Chunking Service for KnowFlow AI.
Coordinates file parsing, chunk generation, and database persistence.
"""
import logging
import traceback
from typing import List
from django.db import transaction
from django.utils.translation import gettext_lazy as _

from apps.documents.models import (
    Document,
    DocumentVersion,
    DocumentChunk,
    DocumentStatus
)
from apps.documents.pipeline.parsers import ParserFactory
from apps.documents.pipeline.chunkers import RecursiveCharacterChunker

logger = logging.getLogger(__name__)


class DocumentIngestionService:
    """
    Coordinates end-to-end ingestion:
    1. Status transition (QUEUED -> PROCESSING)
    2. Format detection & text parsing
    3. Semantic hierarchical chunking
    4. Database persistence of DocumentChunk records
    5. Final status update (READY or FAILED)
    """

    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 150):
        self.chunker = RecursiveCharacterChunker(chunk_size=chunk_size, chunk_overlap=chunk_overlap)

    def process_version(self, version_id: str) -> List[DocumentChunk]:
        """
        Executes ingestion pipeline for a given DocumentVersion.
        Idempotent: removes existing chunks for this version before creating new ones.
        """
        try:
            version = DocumentVersion.objects.select_related('document', 'document__workspace').get(id=version_id)
        except DocumentVersion.DoesNotExist:
            logger.error("DocumentVersion with id %s not found for processing.", version_id)
            raise

        doc = version.document
        workspace = doc.workspace

        # 1. Update status to PROCESSING
        version.processing_status = DocumentStatus.PROCESSING
        version.error_message = ""
        version.save(update_fields=['processing_status', 'error_message', 'updated_at'])

        doc.status = DocumentStatus.PROCESSING
        doc.save(update_fields=['status', 'updated_at'])

        try:
            # 2. Select parser & parse content
            parser = ParserFactory.get_parser(
                filename=version.original_filename,
                file_type=doc.file_type,
                mime_type=version.mime_type
            )

            with version.file.open('rb') as f:
                parsed_doc = parser.parse(f, original_filename=version.original_filename)

            # 3. Generate semantic chunks
            base_metadata = {
                "document_id": str(doc.id),
                "document_title": doc.title,
                "version_id": str(version.id),
                "version_number": version.version_number,
                "workspace_id": str(workspace.id),
                "original_filename": version.original_filename,
            }

            raw_chunks = self.chunker.chunk_document(parsed_doc, base_metadata=base_metadata)

            # 4. Atomically persist chunks & update status
            with transaction.atomic():
                # Delete existing chunks for idempotency
                DocumentChunk.objects.filter(version=version).delete()

                chunk_instances = [
                    DocumentChunk(
                        document=doc,
                        version=version,
                        workspace=workspace,
                        chunk_index=rc.chunk_index,
                        content=rc.content,
                        page_number=rc.page_number,
                        section_header=rc.section_header,
                        char_count=rc.char_count,
                        token_count_estimate=rc.token_count_estimate,
                        metadata=rc.metadata
                    )
                    for rc in raw_chunks
                ]

                created_chunks = DocumentChunk.objects.bulk_create(chunk_instances)

                # Update version status to READY
                version.processing_status = DocumentStatus.READY
                version.save(update_fields=['processing_status', 'updated_at'])

                # Update document status to READY if active version is ready
                if version.is_active:
                    doc.status = DocumentStatus.READY
                    doc.save(update_fields=['status', 'updated_at'])

            logger.info(
                "Successfully processed DocumentVersion %s (%s). Created %d chunks.",
                version.id,
                version.original_filename,
                len(created_chunks)
            )
            return created_chunks

        except Exception as exc:
            tb = traceback.format_exc()
            logger.error("Processing failed for DocumentVersion %s: %s\n%s", version_id, exc, tb)

            version.processing_status = DocumentStatus.FAILED
            version.error_message = f"{str(exc)}\n\n{tb}"
            version.save(update_fields=['processing_status', 'error_message', 'updated_at'])

            if version.is_active:
                doc.status = DocumentStatus.FAILED
                doc.save(update_fields=['status', 'updated_at'])

            raise
