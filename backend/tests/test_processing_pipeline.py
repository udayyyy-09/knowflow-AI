"""
Comprehensive Unit & Integration Tests for Processing Pipeline (Phase 3).

Tests:
1. Parsers: PDFParser, DOCXParser, MarkdownParser, TextParser, and ParserFactory.
2. Semantic Chunker: RecursiveCharacterChunker (overlap, section metadata, page tagging).
3. Ingestion Service & Celery Task: Full end-to-end ingestion, idempotency, error recovery.
4. REST APIs: Chunk list endpoint and Reprocess trigger endpoint with RBAC.
"""
import os
import pytest
from pathlib import Path
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status

from apps.documents.models import Document, DocumentVersion, DocumentChunk, DocumentStatus, DocumentFileType
from apps.documents.pipeline.parsers import (
    PDFParser,
    DOCXParser,
    MarkdownParser,
    TextParser,
    ParserFactory,
    ParsedBlock,
    ParsedDocument,
)
from apps.documents.pipeline.chunkers import RecursiveCharacterChunker
from apps.documents.services.ingestion import DocumentIngestionService
from apps.documents.tasks import process_document_version
from tests.conftest import make_client_for_user

SAMPLE_DOCS_DIR = Path(__file__).resolve().parent.parent.parent / "sample_documents"


# ============================================================================
# 1. PARSER UNIT TESTS
# ============================================================================

class TestParsers:
    """Unit tests for individual file format parsers."""

    def test_pdf_parser_with_sample_file(self):
        pdf_path = SAMPLE_DOCS_DIR / "company_policy.pdf"
        assert pdf_path.exists(), "Sample PDF file must exist"

        parser = PDFParser()
        parsed_doc = parser.parse(str(pdf_path), original_filename="company_policy.pdf")

        assert isinstance(parsed_doc, ParsedDocument)
        assert parsed_doc.total_pages is not None
        assert parsed_doc.total_pages >= 1
        assert len(parsed_doc.blocks) >= 1
        assert parsed_doc.char_count > 0

        # Check page numbering on blocks
        for block in parsed_doc.blocks:
            assert block.page_number is not None
            assert block.page_number >= 1
            assert len(block.content) > 0

    def test_docx_parser_with_sample_file(self):
        docx_path = SAMPLE_DOCS_DIR / "handbook.docx"
        assert docx_path.exists(), "Sample DOCX file must exist"

        parser = DOCXParser()
        parsed_doc = parser.parse(str(docx_path), original_filename="handbook.docx")

        assert isinstance(parsed_doc, ParsedDocument)
        assert len(parsed_doc.blocks) >= 1
        assert parsed_doc.char_count > 0

    def test_markdown_parser_with_sample_file(self):
        md_path = SAMPLE_DOCS_DIR / "company_leave_and_vacation_policy.md"
        assert md_path.exists(), "Sample MD file must exist"

        parser = MarkdownParser()
        parsed_doc = parser.parse(str(md_path), original_filename="company_leave_and_vacation_policy.md")

        assert isinstance(parsed_doc, ParsedDocument)
        assert len(parsed_doc.blocks) >= 1
        assert parsed_doc.char_count > 0
        assert any(b.section_header for b in parsed_doc.blocks)

    def test_text_parser_with_sample_file(self):
        txt_path = SAMPLE_DOCS_DIR / "remote_work_and_travel_expense_policy.txt"
        assert txt_path.exists(), "Sample TXT file must exist"

        parser = TextParser()
        parsed_doc = parser.parse(str(txt_path), original_filename="remote_work_and_travel_expense_policy.txt")

        assert isinstance(parsed_doc, ParsedDocument)
        assert len(parsed_doc.blocks) >= 1
        assert parsed_doc.char_count > 0

    def test_parser_factory_resolution(self):
        assert isinstance(ParserFactory.get_parser("document.pdf"), PDFParser)
        assert isinstance(ParserFactory.get_parser("report.docx"), DOCXParser)
        assert isinstance(ParserFactory.get_parser("guide.md"), MarkdownParser)
        assert isinstance(ParserFactory.get_parser("notes.txt"), TextParser)
        assert isinstance(ParserFactory.get_parser(file_type=DocumentFileType.PDF), PDFParser)
        assert isinstance(ParserFactory.get_parser(mime_type="application/pdf"), PDFParser)
        assert isinstance(ParserFactory.get_parser("unknown.xyz"), TextParser)


# ============================================================================
# 2. CHUNKER UNIT TESTS
# ============================================================================

class TestRecursiveCharacterChunker:
    """Unit tests for the semantic recursive character chunker."""

    def test_chunking_small_document(self):
        chunker = RecursiveCharacterChunker(chunk_size=500, chunk_overlap=100)
        parsed_doc = ParsedDocument(
            blocks=[
                ParsedBlock(content="This is a short paragraph.", page_number=1, section_header="Intro")
            ],
            char_count=26
        )

        chunks = chunker.chunk_document(parsed_doc, base_metadata={"doc": "test"})
        assert len(chunks) == 1
        assert chunks[0].chunk_index == 0
        assert chunks[0].content == "This is a short paragraph."
        assert chunks[0].page_number == 1
        assert chunks[0].section_header == "Intro"
        assert chunks[0].char_count == 26
        assert chunks[0].token_count_estimate > 0

    def test_chunking_large_text_with_overlap(self):
        chunker = RecursiveCharacterChunker(chunk_size=200, chunk_overlap=50)
        long_text = (
            "Paragraph one has interesting details about our cloud architecture and microservices. "
            "Paragraph two explains the authentication flow including JWT access and refresh token rotation. "
            "Paragraph three outlines the pgvector hybrid search and BM25 full-text indexing mechanisms. "
            "Paragraph four describes the Celery task broker with Redis for processing background ingestion."
        )
        parsed_doc = ParsedDocument(
            blocks=[
                ParsedBlock(content=long_text, page_number=2, section_header="Architecture")
            ]
        )

        chunks = chunker.chunk_document(parsed_doc)
        assert len(chunks) > 1

        # Check sequential chunk index and metadata propagation
        for idx, ch in enumerate(chunks):
            assert ch.chunk_index == idx
            assert ch.page_number == 2
            assert ch.section_header == "Architecture"
            assert ch.char_count > 0

    def test_invalid_overlap_raises_error(self):
        with pytest.raises(ValueError):
            RecursiveCharacterChunker(chunk_size=100, chunk_overlap=150)


# ============================================================================
# 3. INGESTION SERVICE & CELERY TASK INTEGRATION TESTS
# ============================================================================

@pytest.mark.django_db
class TestIngestionService:
    """Integration tests for DocumentIngestionService and Celery task."""

    def test_process_markdown_version_successfully(self, workspace, workspace_admin):
        md_content = b"# Company Policy\n\n## Working Hours\nStandard working hours are 9 AM to 5 PM.\n\n## Leave Policy\nEmployees get 20 days annual leave."
        doc = Document.objects.create(
            workspace=workspace,
            title="HR Handbook",
            file_type=DocumentFileType.MD,
            status=DocumentStatus.QUEUED,
            created_by=workspace_admin,
        )
        version = DocumentVersion.objects.create(
            document=doc,
            uploaded_by=workspace_admin,
            version_number=1,
            file=SimpleUploadedFile("policy.md", md_content, content_type="text/markdown"),
            original_filename="policy.md",
            file_size_bytes=len(md_content),
            file_hash_sha256="dummy_hash_1",
            mime_type="text/markdown",
            processing_status=DocumentStatus.QUEUED,
            is_active=True,
        )

        service = DocumentIngestionService(chunk_size=300, chunk_overlap=50)
        chunks = service.process_version(str(version.id))

        assert len(chunks) >= 1
        assert DocumentChunk.objects.filter(version=version).count() == len(chunks)

        version.refresh_from_db()
        doc.refresh_from_db()
        assert version.processing_status == DocumentStatus.READY
        assert doc.status == DocumentStatus.READY
        assert version.error_message == ""

    def test_ingestion_idempotency_clears_old_chunks(self, workspace, workspace_admin):
        content = b"Some test document content that gets chunked twice."
        doc = Document.objects.create(
            workspace=workspace,
            title="Idempotency Test",
            file_type=DocumentFileType.TXT,
            status=DocumentStatus.QUEUED,
            created_by=workspace_admin,
        )
        version = DocumentVersion.objects.create(
            document=doc,
            uploaded_by=workspace_admin,
            version_number=1,
            file=SimpleUploadedFile("test.txt", content, content_type="text/plain"),
            original_filename="test.txt",
            file_size_bytes=len(content),
            file_hash_sha256="dummy_hash_idem",
            mime_type="text/plain",
            processing_status=DocumentStatus.QUEUED,
            is_active=True,
        )

        service = DocumentIngestionService()
        first_run_chunks = service.process_version(str(version.id))
        assert len(first_run_chunks) >= 1
        initial_chunk_ids = [c.id for c in first_run_chunks]

        # Second run on same version
        second_run_chunks = service.process_version(str(version.id))
        assert len(second_run_chunks) == len(first_run_chunks)
        second_chunk_ids = [c.id for c in second_run_chunks]

        # Old chunk IDs were deleted and replaced cleanly
        assert initial_chunk_ids != second_chunk_ids

    def test_celery_task_execution(self, workspace, workspace_admin):
        content = b"# Celery Test Document\n\nAsynchronous processing validation."
        doc = Document.objects.create(
            workspace=workspace,
            title="Celery Doc",
            file_type=DocumentFileType.MD,
            status=DocumentStatus.QUEUED,
            created_by=workspace_admin,
        )
        version = DocumentVersion.objects.create(
            document=doc,
            uploaded_by=workspace_admin,
            version_number=1,
            file=SimpleUploadedFile("celery.md", content, content_type="text/markdown"),
            original_filename="celery.md",
            file_size_bytes=len(content),
            file_hash_sha256="dummy_hash_celery",
            mime_type="text/markdown",
            processing_status=DocumentStatus.QUEUED,
            is_active=True,
        )

        result = process_document_version(str(version.id))
        assert result["status"] == "SUCCESS"
        assert result["chunks_count"] >= 1

        version.refresh_from_db()
        assert version.processing_status == DocumentStatus.READY


# ============================================================================
# 4. CHUNK LIST & REPROCESS REST API TESTS
# ============================================================================

@pytest.mark.django_db
class TestChunkAndReprocessAPIs:
    """Integration tests for chunk inspection and reprocessing endpoints."""

    def test_get_document_chunks(self, workspace, workspace_admin, workspace_employee):
        # Create document with 2 chunks
        doc = Document.objects.create(
            workspace=workspace,
            title="API Chunk Test",
            file_type=DocumentFileType.TXT,
            status=DocumentStatus.READY,
            created_by=workspace_admin,
        )
        version = DocumentVersion.objects.create(
            document=doc,
            uploaded_by=workspace_admin,
            version_number=1,
            file=SimpleUploadedFile("chunks.txt", b"Chunk one content. Chunk two content."),
            original_filename="chunks.txt",
            file_size_bytes=38,
            file_hash_sha256="dummy_hash_chunks",
            mime_type="text/plain",
            processing_status=DocumentStatus.READY,
            is_active=True,
        )
        DocumentChunk.objects.create(
            document=doc,
            version=version,
            workspace=workspace,
            chunk_index=0,
            content="Chunk one content.",
            char_count=18,
            token_count_estimate=4,
        )
        DocumentChunk.objects.create(
            document=doc,
            version=version,
            workspace=workspace,
            chunk_index=1,
            content="Chunk two content.",
            char_count=18,
            token_count_estimate=4,
        )

        # Employee requests chunks
        client = make_client_for_user(workspace_employee)
        url = reverse('workspaces:documents:document-chunks', kwargs={'workspace_id': workspace.id, 'document_id': doc.id})
        res = client.get(url)

        assert res.status_code == status.HTTP_200_OK
        assert res.data['success'] is True
        assert res.data['count'] == 2
        assert len(res.data['data']) == 2
        assert res.data['data'][0]['chunk_index'] == 0
        assert res.data['data'][0]['content'] == "Chunk one content."

    def test_reprocess_document_endpoint(self, workspace, workspace_admin, outsider):
        content = b"Content to reprocess."
        doc = Document.objects.create(
            workspace=workspace,
            title="Reprocess Doc",
            file_type=DocumentFileType.TXT,
            status=DocumentStatus.READY,
            created_by=workspace_admin,
        )
        version = DocumentVersion.objects.create(
            document=doc,
            uploaded_by=workspace_admin,
            version_number=1,
            file=SimpleUploadedFile("reprocess.txt", content),
            original_filename="reprocess.txt",
            file_size_bytes=len(content),
            file_hash_sha256="dummy_hash_rep",
            mime_type="text/plain",
            processing_status=DocumentStatus.READY,
            is_active=True,
        )

        admin_client = make_client_for_user(workspace_admin)
        url = reverse('workspaces:documents:document-reprocess', kwargs={'workspace_id': workspace.id, 'document_id': doc.id})

        res = admin_client.post(url, {})
        assert res.status_code == status.HTTP_202_ACCEPTED
        assert res.data['success'] is True

        # Outsider is denied
        out_client = make_client_for_user(outsider)
        res_out = out_client.post(url, {})
        assert res_out.status_code == status.HTTP_403_FORBIDDEN
