"""
Central Cache Key Registry for KnowFlow AI.
Ensures standardized namespaces, deterministic hashing, and clear parameter boundaries across all caching layers.
"""
import hashlib
from typing import Optional


class CacheKeys:
    """
    Standardized cache key generators for KnowFlow AI.
    """

    PREFIX_EMBEDDING = "kf:emb"
    PREFIX_RAG_ANSWER = "kf:rag:ans"
    PREFIX_KNOWLEDGE_VER = "kf:ws:kver"
    PREFIX_USER_ROLE = "kf:auth:role"
    PREFIX_WS_DETAIL = "kf:ws:detail"
    PREFIX_DOC_LIST = "kf:doc:list"
    PREFIX_PROMPTS = "knowflow:prompts"

    @classmethod
    def _hash_text(cls, text: str) -> str:
        """Returns a deterministic lowercase SHA-256 hash of normalized text."""
        normalized = (text or "").strip().lower()
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    @classmethod
    def query_embedding(cls, provider: str, model_name: str, query_text: str) -> str:
        """
        Cache key for deterministic query embedding vectors.
        Example: kf:emb:openai:text-embedding-3-small:a1b2c3d4...
        """
        q_hash = cls._hash_text(query_text)
        clean_provider = (provider or "unknown").strip().lower()
        clean_model = (model_name or "unknown").strip().lower().replace("/", "_")
        return f"{cls.PREFIX_EMBEDDING}:{clean_provider}:{clean_model}:{q_hash}"

    @classmethod
    def rag_answer(
        cls,
        workspace_id: str,
        knowledge_ver: int,
        prompt_ver: str,
        model_id: str,
        query_text: str,
    ) -> str:
        """
        Multi-dimensional cache key for RAG answers & sanitized citations.
        Guarantees invalidation across:
          1. workspace_id (tenant isolation)
          2. knowledge_ver (document additions/updates/deletions)
          3. prompt_ver (system prompt or user template modifications)
          4. model_id (LLM provider / model swaps)
          5. query_text hash

        Example: kf:rag:ans:ws-123:v3:p8f3a1b2:m-gemini-3.6-flash:e3b0c4429...
        """
        q_hash = cls._hash_text(query_text)
        clean_ws = str(workspace_id).strip()
        clean_prompt = (prompt_ver or "default").strip()
        clean_model = (model_id or "default").strip().replace("/", "_")
        return f"{cls.PREFIX_RAG_ANSWER}:{clean_ws}:v{knowledge_ver}:p{clean_prompt}:m{clean_model}:{q_hash}"

    @classmethod
    def workspace_knowledge_ver(cls, workspace_id: str) -> str:
        """
        Cache key for the workspace knowledge version counter.
        Example: kf:ws:kver:ws-123
        """
        return f"{cls.PREFIX_KNOWLEDGE_VER}:{str(workspace_id).strip()}"

    @classmethod
    def workspace_role(cls, user_id: str, workspace_id: str) -> str:
        """
        Cache key for the user's role in a given workspace.
        Example: kf:auth:role:usr-456:ws-123
        """
        return f"{cls.PREFIX_USER_ROLE}:{str(user_id).strip()}:{str(workspace_id).strip()}"

    @classmethod
    def workspace_detail(cls, workspace_id: str) -> str:
        """
        Cache key for serialized workspace details.
        Example: kf:ws:detail:ws-123
        """
        return f"{cls.PREFIX_WS_DETAIL}:{str(workspace_id).strip()}"

    PREFIX_MEMBER_LIST = "kf:ws:members"

    @classmethod
    def workspace_members(cls, workspace_id: str) -> str:
        """Cache key for workspace member list."""
        return f"{cls.PREFIX_MEMBER_LIST}:{str(workspace_id).strip()}"

    @classmethod
    def workspace_documents(cls, workspace_id: str) -> str:
        """Cache key for workspace document list."""
        return f"{cls.PREFIX_DOC_LIST}:{str(workspace_id).strip()}"

    @classmethod
    def document_list(cls, workspace_id: str, page: int = 1, search: str = "") -> str:
        """
        Cache key for workspace document lists.
        Example: kf:doc:list:ws-123:p1:s-leave
        """
        clean_search = (search or "").strip().lower()
        search_suffix = f":s_{cls._hash_text(clean_search)[:8]}" if clean_search else ""
        return f"{cls.PREFIX_DOC_LIST}:{str(workspace_id).strip()}:p{page}{search_suffix}"
