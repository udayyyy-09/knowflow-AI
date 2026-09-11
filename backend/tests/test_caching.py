"""
Unit and Integration Tests for KnowFlow AI Caching Strategy.
Tests CacheKeys, CacheService, Query Embedding Cache, Multi-Dimensional RAG Answer Cache,
and Workspace Role & Permission Caching.
"""
import pytest
from unittest.mock import patch, MagicMock
from django.core.cache import cache

from apps.common.cache.keys import CacheKeys
from apps.common.cache.cache_service import CacheService
from apps.chat.services.prompt_manager import PromptManager
from apps.chat.services.rag_service import RAGService
from apps.chat.models import Conversation, Message, MessageRole
from apps.workspaces.models import Workspace, WorkspaceMembership, WorkspaceRole
from apps.workspaces.permissions import get_user_workspace_role
from apps.documents.services.embedding_service import EmbeddingService
from apps.documents.pipeline.embeddings.mock_provider import MockEmbeddingProvider
from apps.chat.pipeline.llm.mock_provider import MockLLMProvider


@pytest.fixture(autouse=True)
def clean_redis_cache():
    """Clears cache before and after every test."""
    cache.clear()
    PromptManager.clear_cache()
    yield
    cache.clear()
    PromptManager.clear_cache()


@pytest.mark.django_db
class TestCacheKeysRegistry:
    """Tests deterministic key formatting and multi-dimensional uniqueness."""

    def test_query_embedding_key_is_deterministic(self):
        k1 = CacheKeys.query_embedding("openai", "text-embedding-3-small", "What is the leave policy?")
        k2 = CacheKeys.query_embedding("openai", "text-embedding-3-small", "  what is the leave policy? ")
        assert k1 == k2
        assert "kf:emb:openai:text-embedding-3-small:" in k1

    def test_rag_answer_key_multi_dimensional_uniqueness(self):
        base_key = CacheKeys.rag_answer("ws-1", 1, "prompt_v1", "gemini-1.5-flash", "What is the policy?")

        # 1. Changing workspace produces distinct key
        diff_ws = CacheKeys.rag_answer("ws-2", 1, "prompt_v1", "gemini-1.5-flash", "What is the policy?")
        assert base_key != diff_ws

        # 2. Changing knowledge version produces distinct key
        diff_kver = CacheKeys.rag_answer("ws-1", 2, "prompt_v1", "gemini-1.5-flash", "What is the policy?")
        assert base_key != diff_kver

        # 3. Changing prompt version produces distinct key
        diff_pver = CacheKeys.rag_answer("ws-1", 1, "prompt_v2", "gemini-1.5-flash", "What is the policy?")
        assert base_key != diff_pver

        # 4. Changing model produces distinct key
        diff_model = CacheKeys.rag_answer("ws-1", 1, "prompt_v1", "gemini-1.5-pro", "What is the policy?")
        assert base_key != diff_model

        # 5. Changing query text produces distinct key
        diff_q = CacheKeys.rag_answer("ws-1", 1, "prompt_v1", "gemini-1.5-flash", "How do I claim expenses?")
        assert base_key != diff_q


@pytest.mark.django_db
class TestCacheService:
    """Tests CacheService knowledge version tracking and typed getters/setters."""

    def test_knowledge_version_bump(self):
        ws_id = "test-workspace-101"
        assert CacheService.get_knowledge_version(ws_id) == 1
        
        v2 = CacheService.bump_knowledge_version(ws_id)
        assert v2 == 2
        assert CacheService.get_knowledge_version(ws_id) == 2

        v3 = CacheService.bump_knowledge_version(ws_id)
        assert v3 == 3
        assert CacheService.get_knowledge_version(ws_id) == 3

    def test_rag_answer_cache_roundtrip(self):
        ws_id = "ws-test"
        payload = {
            "content": "The standard leave is 20 days. [1]",
            "citations": [{"chunk_id": "c1", "citation_index": 1, "document_title": "HR Policy"}],
            "prompt_tokens": 120,
            "completion_tokens": 15,
            "total_tokens": 135,
        }

        # Initially empty
        res = CacheService.get_rag_answer(ws_id, 1, "pv1", "mock-model", "leave policy")
        assert res is None

        # Set cache
        CacheService.set_rag_answer(ws_id, 1, "pv1", "mock-model", "leave policy", payload)

        # Hit cache
        cached = CacheService.get_rag_answer(ws_id, 1, "pv1", "mock-model", "leave policy")
        assert cached is not None
        assert cached["content"] == payload["content"]
        assert len(cached["citations"]) == 1

        # Bumping knowledge version invalidates (misses) the cached answer
        CacheService.bump_knowledge_version(ws_id)
        assert CacheService.get_rag_answer(ws_id, 2, "pv1", "mock-model", "leave policy") is None


@pytest.mark.django_db
class TestQueryEmbeddingCache:
    """Tests query embedding caching in EmbeddingService."""

    def test_generate_query_embedding_uses_cache(self):
        mock_provider = MockEmbeddingProvider()
        mock_provider.embed_text = MagicMock(return_value=[0.1, 0.2, 0.3])

        service = EmbeddingService(provider=mock_provider)
        query = "How do I request PTO?"

        # First call: hits provider
        vec1 = service.generate_query_embedding(query)
        assert vec1 == [0.1, 0.2, 0.3]
        assert mock_provider.embed_text.call_count == 1

        # Second call: reads from Redis, does not call provider again
        vec2 = service.generate_query_embedding(query)
        assert vec2 == [0.1, 0.2, 0.3]
        assert mock_provider.embed_text.call_count == 1


@pytest.mark.django_db
class TestRAGMultiDimensionalCaching:
    """Tests end-to-end RAG answer caching across prompt versions, models, and knowledge versions."""

    def test_sync_rag_caches_and_serves_on_repeat(self, db, django_user_model):
        user = django_user_model.objects.create_user(
            email="caching_tester@knowflow.ai",
            password="testpassword123",
            first_name="Test",
            last_name="Tester",
        )
        ws = Workspace.objects.create(name="Caching Test Workspace", created_by=user)
        WorkspaceMembership.objects.create(workspace=ws, user=user, role=WorkspaceRole.ADMIN)
        conv = Conversation.objects.create(workspace=ws, user=user, title="RAG Caching Test")

        mock_llm = MockLLMProvider()
        mock_llm.generate = MagicMock(
            return_value=MagicMock(
                content="According to the policy, employees receive 20 annual days [1].",
                prompt_tokens=80,
                completion_tokens=20,
                total_tokens=100,
            )
        )

        with patch("apps.chat.services.rag_service.LLMProviderFactory.get_provider", return_value=mock_llm):
            rag = RAGService()
            query = "What is the annual leave allowance?"

            # Turn 1: Cold cache -> calls LLM
            msg1, cit1 = rag.process_message_sync(conv, user, query)
            assert mock_llm.generate.call_count == 1
            assert "20 annual days" in msg1.content

            # Turn 2: Identical query -> Cache HIT -> does NOT call LLM
            conv2 = Conversation.objects.create(workspace=ws, user=user, title="RAG Caching Test 2")
            msg2, cit2 = rag.process_message_sync(conv2, user, query)
            assert mock_llm.generate.call_count == 1  # Still 1!
            assert msg2.content == msg1.content

            # Turn 3: Bump knowledge version (simulating document upload/re-index) -> Cache MISS -> calls LLM again
            CacheService.bump_knowledge_version(str(ws.id))
            conv3 = Conversation.objects.create(workspace=ws, user=user, title="RAG Caching Test 3")
            msg3, cit3 = rag.process_message_sync(conv3, user, query)
            assert mock_llm.generate.call_count == 2  # Incremented to 2!

            # Turn 4: Change prompt version -> Cache MISS -> calls LLM again
            with patch.object(PromptManager, "get_prompt_version_hash", return_value="v2_custom_prompt_hash"):
                conv4 = Conversation.objects.create(workspace=ws, user=user, title="RAG Caching Test 4")
                msg4, cit4 = rag.process_message_sync(conv4, user, query)
                assert mock_llm.generate.call_count == 3  # Incremented to 3!

            # Turn 5: Change model name -> Cache MISS -> calls LLM again
            mock_llm.get_model_name = MagicMock(return_value="gemini-1.5-pro")
            conv5 = Conversation.objects.create(workspace=ws, user=user, title="RAG Caching Test 5")
            msg5, cit5 = rag.process_message_sync(conv5, user, query)
            assert mock_llm.generate.call_count == 4  # Incremented to 4!


@pytest.mark.django_db
class TestWorkspaceRoleCaching:
    """Tests Redis caching of workspace user roles and automated invalidation on membership change."""

    def test_role_caching_and_invalidation(self, db, django_user_model):
        user = django_user_model.objects.create_user(
            email="role_cache_user@knowflow.ai",
            password="testpassword123",
        )
        ws = Workspace.objects.create(name="Role Cache WS", created_by=user)
        membership = WorkspaceMembership.objects.create(workspace=ws, user=user, role=WorkspaceRole.EMPLOYEE)

        # 1. Initial lookup populates cache
        role1 = get_user_workspace_role(user, str(ws.id))
        assert role1 == WorkspaceRole.EMPLOYEE

        # Verify role is stored in Redis cache
        cached_role = CacheService.get_user_workspace_role(str(user.id), str(ws.id))
        assert cached_role == WorkspaceRole.EMPLOYEE

        # 2. Update role in DB without invalidating cache
        membership.role = WorkspaceRole.ADMIN
        membership.save(update_fields=['role'])

        # Cached role still returns previous role until invalidated
        assert get_user_workspace_role(user, str(ws.id)) == WorkspaceRole.EMPLOYEE

        # 3. Invalidate role cache
        CacheService.invalidate_user_workspace_role(str(user.id), str(ws.id))
        assert CacheService.get_user_workspace_role(str(user.id), str(ws.id)) is None

        # 4. Next lookup fetches fresh role from DB and warms cache
        role2 = get_user_workspace_role(user, str(ws.id))
        assert role2 == WorkspaceRole.ADMIN
        assert CacheService.get_user_workspace_role(str(user.id), str(ws.id)) == WorkspaceRole.ADMIN
