"""
Comprehensive Unit & Integration Tests for Embeddings & Vector Search (Phase 4).

Covers:
- Embedding Providers (Mock, OpenAI, Gemini, Factory)
- Embedding Generation Service (Batching, Idempotency, Database Persistence)
- Vector Search Service (Multi-tenant isolation, Ranking, Filters)
- Pipeline Integration (Parsing -> Chunking -> Embedding -> Search)
- API Endpoints (POST /search/, POST /reembed/, RBAC Permissions)
"""
import math
import uuid
import pytest
from unittest.mock import patch, MagicMock
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.workspaces.models import Workspace, WorkspaceMembership, WorkspaceRole
from apps.documents.models import Document, DocumentVersion, DocumentChunk, Embedding, DocumentStatus, DocumentFileType
from apps.documents.pipeline.embeddings.mock_provider import MockEmbeddingProvider
from apps.documents.pipeline.embeddings.openai_provider import OpenAIEmbeddingProvider
from apps.documents.pipeline.embeddings.gemini_provider import GeminiEmbeddingProvider
from apps.documents.pipeline.embeddings.factory import EmbeddingProviderFactory
from apps.documents.services.embedding_service import EmbeddingService
from apps.documents.services.vector_search import VectorSearchService
from apps.documents.services.ingestion import DocumentIngestionService
from apps.documents.tasks import reembed_document_version, reembed_workspace


@pytest.mark.django_db
class TestEmbeddingProviders:
    """
    Unit tests for embedding providers.
    """

    def test_mock_provider_unit_norm_and_dimensions(self):
        provider = MockEmbeddingProvider(dimensions=128)
        assert provider.get_dimensions() == 128
        assert provider.get_model_name() == "mock-embedding-v1"

        vec = provider.embed_text("Employee leave policy guidelines.")
        assert len(vec) == 128

        # Verify unit norm ||v|| = 1.0
        norm = math.sqrt(sum(x * x for x in vec))
        assert pytest.approx(norm, 1e-4) == 1.0

    def test_mock_provider_deterministic(self):
        provider = MockEmbeddingProvider(dimensions=64)
        vec1 = provider.embed_text("KnowFlow AI architecture overview.")
        vec2 = provider.embed_text("KnowFlow AI architecture overview.")
        assert vec1 == vec2

    def test_mock_provider_batch(self):
        provider = MockEmbeddingProvider(dimensions=64)
        texts = ["Text one", "Text two", "Text three"]
        batch_vecs = provider.embed_batch(texts)
        assert len(batch_vecs) == 3
        for v in batch_vecs:
            assert len(v) == 64

    def test_mock_provider_empty_input(self):
        provider = MockEmbeddingProvider(dimensions=64)
        vec = provider.embed_text("")
        assert len(vec) == 64
        assert vec[0] == 1.0

    @patch("apps.documents.pipeline.embeddings.openai_provider.requests.post")
    def test_openai_provider_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [
                {"index": 0, "embedding": [0.1] * 1536},
                {"index": 1, "embedding": [0.2] * 1536},
            ]
        }
        mock_post.return_value = mock_response

        provider = OpenAIEmbeddingProvider(api_key="test-key", model_name="text-embedding-3-small")
        results = provider.embed_batch(["First text", "Second text"])
        assert len(results) == 2
        assert len(results[0]) == 1536

    @patch("apps.documents.pipeline.embeddings.openai_provider.requests.post")
    def test_openai_provider_error_handling(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Invalid API Key"
        mock_post.return_value = mock_response

        provider = OpenAIEmbeddingProvider(api_key="invalid-key")
        with pytest.raises(RuntimeError, match=r"OpenAI Embeddings API error \[401\]"):
            provider.embed_text("Test query")

    def test_openai_provider_missing_key(self):
        provider = OpenAIEmbeddingProvider(api_key="")
        with pytest.raises(ValueError, match="OPENAI_API_KEY is not configured"):
            provider.embed_text("Test query")

    @patch("apps.documents.pipeline.embeddings.gemini_provider.requests.post")
    def test_gemini_provider_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "embedding": {
                "values": [0.5] * 1536,
            }
        }
        mock_post.return_value = mock_response

        provider = GeminiEmbeddingProvider(api_key="test-gemini-key", model_name="gemini-embedding-001", dimensions=1536)
        res = provider.embed_text("Gemini query")
        assert len(res) == 1536

    @patch("apps.documents.pipeline.embeddings.gemini_provider.requests.post")
    def test_gemini_provider_error_handling(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_post.return_value = mock_response

        provider = GeminiEmbeddingProvider(api_key="test-gemini-key")
        with pytest.raises(RuntimeError, match=r"Gemini Embeddings API error \[500\]"):
            provider.embed_text("Gemini query")


    def test_embedding_provider_factory(self):
        EmbeddingProviderFactory.clear_cache()
        mock_p = EmbeddingProviderFactory.get_provider(provider_name="mock", dimensions=256)
        assert isinstance(mock_p, MockEmbeddingProvider)
        assert mock_p.get_dimensions() == 256

        # Cached singleton verification
        cached_p = EmbeddingProviderFactory.get_provider(provider_name="mock", dimensions=256)
        assert mock_p is cached_p

        with pytest.raises(ValueError, match="Unsupported embedding provider"):
            EmbeddingProviderFactory.get_provider(provider_name="unknown_provider")


@pytest.mark.django_db
class TestEmbeddingService:
    """
    Integration tests for EmbeddingService and database persistence.
    """

    def test_generate_and_persist_embeddings(self, workspace, workspace_admin):
        doc = Document.objects.create(
            workspace=workspace,
            created_by=workspace_admin,
            title="HR Handbook",
            file_type=DocumentFileType.TXT,
        )
        version = DocumentVersion.objects.create(
            document=doc,
            uploaded_by=workspace_admin,
            version_number=1,
            file=SimpleUploadedFile("handbook.txt", b"HR leave policy content."),
            original_filename="handbook.txt",
            file_size_bytes=24,
            file_hash_sha256="abc123sha",
        )

        chunk1 = DocumentChunk.objects.create(
            document=doc,
            version=version,
            workspace=workspace,
            chunk_index=0,
            content="Employees receive 15 days of annual leave.",
            char_count=42,
            token_count_estimate=10,
        )
        chunk2 = DocumentChunk.objects.create(
            document=doc,
            version=version,
            workspace=workspace,
            chunk_index=1,
            content="Medical insurance covers up to $10,000 per year.",
            char_count=48,
            token_count_estimate=12,
        )

        provider = MockEmbeddingProvider(dimensions=1536)
        service = EmbeddingService(provider=provider, batch_size=10)

        embeddings = service.generate_embeddings_for_chunks([chunk1, chunk2])
        assert len(embeddings) == 2
        assert Embedding.objects.filter(document=doc).count() == 2

        emb1 = Embedding.objects.get(chunk=chunk1)
        assert emb1.workspace == workspace
        assert emb1.document == doc
        assert len(emb1.vector) == 1536
        assert emb1.is_active is True

    def test_embedding_generation_idempotency(self, workspace, workspace_admin):
        doc = Document.objects.create(
            workspace=workspace,
            created_by=workspace_admin,
            title="Engineering Guide",
            file_type=DocumentFileType.TXT,
        )
        version = DocumentVersion.objects.create(
            document=doc,
            uploaded_by=workspace_admin,
            version_number=1,
            file=SimpleUploadedFile("guide.txt", b"Engineering coding standards."),
            original_filename="guide.txt",
            file_size_bytes=30,
            file_hash_sha256="hash456",
        )
        chunk = DocumentChunk.objects.create(
            document=doc,
            version=version,
            workspace=workspace,
            chunk_index=0,
            content="All PRs require at least one reviewer approval.",
        )

        service = EmbeddingService(provider=MockEmbeddingProvider(dimensions=1536))
        # First pass
        service.generate_embeddings_for_chunks([chunk])
        assert Embedding.objects.filter(chunk=chunk).count() == 1

        # Second pass (re-embedding same chunk)
        service.generate_embeddings_for_chunks([chunk])
        assert Embedding.objects.filter(chunk=chunk).count() == 1

    def test_query_embedding_empty_error(self):
        service = EmbeddingService(provider=MockEmbeddingProvider(dimensions=1536))
        with pytest.raises(ValueError, match="Query text cannot be empty"):
            service.generate_query_embedding("   ")


@pytest.mark.django_db
class TestVectorSearchService:
    """
    Tests for multi-tenant vector similarity retrieval, ranking, and authorization filters.
    """

    @pytest.fixture
    def populated_knowledge_base(self, db, workspace_admin, user_factory):
        ws_a = Workspace.objects.create(name="Engineering Workspace", slug="eng-ws", created_by=workspace_admin)
        ws_b = Workspace.objects.create(name="Finance Workspace", slug="fin-ws", created_by=workspace_admin)

        WorkspaceMembership.objects.create(workspace=ws_a, user=workspace_admin, role=WorkspaceRole.ADMIN)
        WorkspaceMembership.objects.create(workspace=ws_b, user=workspace_admin, role=WorkspaceRole.ADMIN)

        provider = MockEmbeddingProvider(dimensions=1536)
        service = EmbeddingService(provider=provider)

        # Workspace A Doc: Engineering
        doc_a = Document.objects.create(workspace=ws_a, created_by=workspace_admin, title="Python Guidelines")
        ver_a = DocumentVersion.objects.create(
            document=doc_a, uploaded_by=workspace_admin, version_number=1,
            file=SimpleUploadedFile("py.txt", b"content"), original_filename="py.txt", file_hash_sha256="hash_a"
        )
        c_a1 = DocumentChunk.objects.create(
            document=doc_a, version=ver_a, workspace=ws_a, chunk_index=0,
            content="We use Python 3.12 and Django REST Framework for microservices.", page_number=1, section_header="Stack"
        )
        c_a2 = DocumentChunk.objects.create(
            document=doc_a, version=ver_a, workspace=ws_a, chunk_index=1,
            content="Deployments are managed via Kubernetes Helm charts on AWS EKS.", page_number=2, section_header="DevOps"
        )
        service.generate_embeddings_for_chunks([c_a1, c_a2])

        # Workspace B Doc: Finance
        doc_b = Document.objects.create(workspace=ws_b, created_by=workspace_admin, title="Expense Policy")
        ver_b = DocumentVersion.objects.create(
            document=doc_b, uploaded_by=workspace_admin, version_number=1,
            file=SimpleUploadedFile("exp.txt", b"content"), original_filename="exp.txt", file_hash_sha256="hash_b"
        )
        c_b1 = DocumentChunk.objects.create(
            document=doc_b, version=ver_b, workspace=ws_b, chunk_index=0,
            content="Travel reimbursements must be submitted within 30 days of the trip.", page_number=1, section_header="Reimbursement"
        )
        service.generate_embeddings_for_chunks([c_b1])

        return {
            "user": workspace_admin,
            "ws_a": ws_a,
            "ws_b": ws_b,
            "doc_a": doc_a,
            "doc_b": doc_b,
            "service": service,
        }

    def test_search_retrieves_relevant_chunk(self, populated_knowledge_base):
        kb = populated_knowledge_base
        ws_a = kb["ws_a"]

        search_service = VectorSearchService(embedding_service=kb["service"])
        results = search_service.search(workspace=ws_a, query_text="Python Django REST Framework", top_k=5)

        assert len(results) > 0
        top_result = results[0]
        assert "Python 3.12" in top_result.content
        assert top_result.document_title == "Python Guidelines"
        assert top_result.section_header == "Stack"
        assert top_result.page_number == 1
        assert top_result.similarity_score > 0.0

    def test_strict_multi_tenant_workspace_isolation(self, populated_knowledge_base):
        kb = populated_knowledge_base
        ws_a = kb["ws_a"]
        ws_b = kb["ws_b"]

        search_service = VectorSearchService(embedding_service=kb["service"])

        # Searching for Finance topics in Workspace A MUST NOT return Workspace B chunks
        results_in_a = search_service.search(workspace=ws_a, query_text="Travel reimbursement policy", top_k=5)
        for r in results_in_a:
            assert r.document_title != "Expense Policy"
            assert "reimbursement" not in r.content.lower()

        # Searching in Workspace B returns the expense policy chunk
        results_in_b = search_service.search(workspace=ws_b, query_text="Travel reimbursement policy", top_k=5)
        assert len(results_in_b) >= 1
        assert results_in_b[0].document_title == "Expense Policy"

    def test_inactive_document_is_excluded(self, populated_knowledge_base):
        kb = populated_knowledge_base
        ws_a = kb["ws_a"]
        doc_a = kb["doc_a"]

        # Soft-delete / deactivate document
        doc_a.is_active = False
        doc_a.save()

        search_service = VectorSearchService(embedding_service=kb["service"])
        results = search_service.search(workspace=ws_a, query_text="Python Django Framework", top_k=5)
        assert len(results) == 0

    def test_document_ids_scoping(self, populated_knowledge_base):
        kb = populated_knowledge_base
        ws_a = kb["ws_a"]
        doc_a = kb["doc_a"]

        search_service = VectorSearchService(embedding_service=kb["service"])
        # With valid doc_id
        res = search_service.search(workspace=ws_a, query_text="Python", document_ids=[str(doc_a.id)])
        assert len(res) > 0

        # With non-matching doc_id
        res_empty = search_service.search(workspace=ws_a, query_text="Python", document_ids=[str(uuid.uuid4())])
        assert len(res_empty) == 0


@pytest.mark.django_db
class TestIngestionPipelineWithEmbeddings:
    """
    End-to-end integration tests for Ingestion -> Chunks -> Embeddings.
    """

    def test_full_pipeline_creates_embeddings(self, workspace, workspace_admin):
        content = (
            "# Onboarding Manual\n\n"
            "## Welcome\n"
            "Welcome to the KnowFlow engineering team!\n\n"
            "## Security\n"
            "All laptops must have disk encryption and 2FA enabled.\n"
        )
        file_obj = SimpleUploadedFile("onboarding.md", content.encode("utf-8"), content_type="text/markdown")

        doc = Document.objects.create(
            workspace=workspace,
            created_by=workspace_admin,
            title="Onboarding Manual",
            file_type=DocumentFileType.MD,
        )
        version = DocumentVersion.objects.create(
            document=doc,
            uploaded_by=workspace_admin,
            version_number=1,
            file=file_obj,
            original_filename="onboarding.md",
            file_size_bytes=len(content),
            file_hash_sha256="sha_onboarding",
            mime_type="text/markdown",
            is_active=True,
        )

        service = DocumentIngestionService()
        chunks = service.process_version(str(version.id))

        assert len(chunks) >= 2
        version.refresh_from_db()
        doc.refresh_from_db()

        assert version.processing_status == DocumentStatus.READY
        assert doc.status == DocumentStatus.READY

        # Verify embeddings were created in the database for all chunks
        assert Embedding.objects.filter(document=doc).count() == len(chunks)

    def test_reembed_document_version_task(self, workspace, workspace_admin):
        doc = Document.objects.create(workspace=workspace, created_by=workspace_admin, title="Reembed Doc")
        version = DocumentVersion.objects.create(
            document=doc, uploaded_by=workspace_admin, version_number=1,
            file=SimpleUploadedFile("doc.txt", b"Sample text"), original_filename="doc.txt", file_hash_sha256="hash12"
        )
        DocumentChunk.objects.create(document=doc, version=version, workspace=workspace, chunk_index=0, content="Sample Chunk 1")
        DocumentChunk.objects.create(document=doc, version=version, workspace=workspace, chunk_index=1, content="Sample Chunk 2")

        result = reembed_document_version(str(version.id))
        assert result["status"] == "SUCCESS"
        assert result["embeddings_count"] == 2
        assert Embedding.objects.filter(document=doc).count() == 2

    def test_reembed_workspace_task(self, workspace, workspace_admin):
        doc = Document.objects.create(workspace=workspace, created_by=workspace_admin, title="Doc 1")
        version = DocumentVersion.objects.create(
            document=doc, uploaded_by=workspace_admin, version_number=1,
            file=SimpleUploadedFile("doc1.txt", b"Text"), original_filename="doc1.txt", file_hash_sha256="h1"
        )
        DocumentChunk.objects.create(document=doc, version=version, workspace=workspace, chunk_index=0, content="Content")

        result = reembed_workspace(str(workspace.id))
        assert result["status"] == "SUCCESS"
        assert result["total_embeddings"] == 1


@pytest.mark.django_db
class TestVectorSearchAPI:
    """
    API endpoint tests for POST /api/v1/workspaces/<id>/search/ and reembed views.
    """

    @pytest.fixture
    def search_api_setup(self, db, workspace, workspace_admin):
        doc = Document.objects.create(workspace=workspace, created_by=workspace_admin, title="AI Research Paper")
        version = DocumentVersion.objects.create(
            document=doc, uploaded_by=workspace_admin, version_number=1,
            file=SimpleUploadedFile("paper.txt", b"content"), original_filename="paper.txt", file_hash_sha256="sha_paper"
        )
        c1 = DocumentChunk.objects.create(
            document=doc, version=version, workspace=workspace, chunk_index=0,
            content="Transformer architectures utilize multi-head self-attention mechanisms.",
            page_number=1, section_header="Architecture"
        )
        EmbeddingService().generate_embeddings_for_chunks([c1])

        return {
            "workspace": workspace,
            "doc": doc,
            "version": version,
        }

    def test_search_endpoint_success_for_member(self, employee_client, search_api_setup):
        setup = search_api_setup
        url = f"/api/v1/workspaces/{setup['workspace'].id}/search/"
        payload = {
            "query": "Transformer self-attention mechanism",
            "top_k": 3,
            "min_score": 0.0,
        }
        response = employee_client.post(url, payload, format="json")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["count"] >= 1
        assert len(data["results"]) >= 1
        first_hit = data["results"][0]
        assert "Transformer" in first_hit["content"]
        assert first_hit["document_title"] == "AI Research Paper"
        assert "similarity_score" in first_hit

    def test_search_endpoint_unauthenticated_rejected(self, api_client, search_api_setup):
        setup = search_api_setup
        url = f"/api/v1/workspaces/{setup['workspace'].id}/search/"
        response = api_client.post(url, {"query": "Test"}, format="json")
        assert response.status_code == 401

    def test_search_endpoint_outsider_forbidden(self, outsider_client, search_api_setup):
        setup = search_api_setup
        url = f"/api/v1/workspaces/{setup['workspace'].id}/search/"
        response = outsider_client.post(url, {"query": "Test"}, format="json")
        assert response.status_code == 403

    def test_search_endpoint_validation_error(self, employee_client, search_api_setup):
        setup = search_api_setup
        url = f"/api/v1/workspaces/{setup['workspace'].id}/search/"
        response = employee_client.post(url, {"query": "", "top_k": 100}, format="json")
        assert response.status_code == 400

    def test_reembed_endpoint_admin_success(self, admin_client, search_api_setup):
        setup = search_api_setup
        url = f"/api/v1/workspaces/{setup['workspace'].id}/documents/{setup['doc'].id}/reembed/"
        response = admin_client.post(url, {}, format="json")
        assert response.status_code == 202
        assert response.json()["success"] is True
