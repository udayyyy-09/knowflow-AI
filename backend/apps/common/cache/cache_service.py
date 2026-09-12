"""
Central Cache Service for KnowFlow AI.
Provides clean, safe abstraction over Django Redis cache with error resilience,
knowledge-version tracking, and automated invalidation routines.
"""
import logging
from typing import Any, Optional, Dict, List
from django.core.cache import cache

from apps.common.cache.keys import CacheKeys

logger = logging.getLogger(__name__)


class CacheService:
    """
    High-level caching service providing type-safe get/set/invalidation methods.
    """

    DEFAULT_RAG_ANSWER_TTL = 86400  # 24 hours
    DEFAULT_EMBEDDING_TTL = 86400 * 7  # 7 days
    DEFAULT_ROLE_TTL = 900  # 15 minutes
    DEFAULT_WS_DETAIL_TTL = 600  # 10 minutes

    # -------------------------------------------------------------------------
    # Knowledge Version Tracking & Invalidation
    # -------------------------------------------------------------------------

    @classmethod
    def get_knowledge_version(cls, workspace_id: str) -> int:
        """
        Retrieves the current knowledge version integer for the given workspace.
        Defaults to 1 if not yet initialized.
        """
        key = CacheKeys.workspace_knowledge_ver(workspace_id)
        try:
            ver = cache.get(key)
            if ver is None:
                cache.set(key, 1, timeout=None)
                return 1
            return int(ver)
        except Exception as e:
            logger.warning("Failed to retrieve knowledge version for workspace %s: %s", workspace_id, str(e))
            return 1

    @classmethod
    def bump_knowledge_version(cls, workspace_id: str) -> int:
        """
        Atomically increments the workspace knowledge version counter.
        Instantly orphans and invalidates all previous cached RAG responses for this workspace.
        """
        key = CacheKeys.workspace_knowledge_ver(workspace_id)
        try:
            new_ver = cache.incr(key)
        except (ValueError, Exception):
            try:
                # If key did not exist or backend does not support direct incr on missing key
                cache.set(key, 2, timeout=None)
                new_ver = 2
            except Exception as e:
                logger.error("Failed to bump knowledge version for workspace %s: %s", workspace_id, str(e))
                new_ver = 2

        logger.info("Bumped knowledge version for workspace %s to v%d", workspace_id, new_ver)
        return new_ver

    # -------------------------------------------------------------------------
    # RAG Answer & Citations Cache
    # -------------------------------------------------------------------------

    @classmethod
    def get_rag_answer(
        cls,
        workspace_id: str,
        knowledge_ver: int,
        prompt_ver: str,
        model_id: str,
        query_text: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieves a cached RAG response payload if present.
        Returns dict with: {"content": str, "citations": list, "prompt_tokens": int, ...} or None.
        """
        key = CacheKeys.rag_answer(workspace_id, knowledge_ver, prompt_ver, model_id, query_text)
        try:
            cached_data = cache.get(key)
            if cached_data:
                logger.debug("Cache HIT for RAG answer: %s", key)
                return cached_data
        except Exception as e:
            logger.warning("Error reading RAG answer cache (%s): %s", key, str(e))
        return None

    @classmethod
    def set_rag_answer(
        cls,
        workspace_id: str,
        knowledge_ver: int,
        prompt_ver: str,
        model_id: str,
        query_text: str,
        payload: Dict[str, Any],
        timeout: Optional[int] = None,
    ) -> None:
        """
        Stores a generated RAG response and sanitized citations in Redis.
        """
        key = CacheKeys.rag_answer(workspace_id, knowledge_ver, prompt_ver, model_id, query_text)
        ttl = timeout or cls.DEFAULT_RAG_ANSWER_TTL
        try:
            cache.set(key, payload, timeout=ttl)
            logger.debug("Cached RAG answer for key: %s (TTL: %ds)", key, ttl)
        except Exception as e:
            logger.warning("Error writing RAG answer cache (%s): %s", key, str(e))

    # -------------------------------------------------------------------------
    # Query Embedding Cache
    # -------------------------------------------------------------------------

    @classmethod
    def get_query_embedding(cls, provider: str, model_name: str, query_text: str) -> Optional[List[float]]:
        """
        Retrieves a cached query embedding vector from Redis.
        """
        key = CacheKeys.query_embedding(provider, model_name, query_text)
        try:
            cached_vec = cache.get(key)
            if cached_vec is not None:
                logger.debug("Cache HIT for query embedding: %s", key)
                return cached_vec
        except Exception as e:
            logger.warning("Error reading query embedding cache (%s): %s", key, str(e))
        return None

    @classmethod
    def set_query_embedding(
        cls,
        provider: str,
        model_name: str,
        query_text: str,
        vector: List[float],
        timeout: Optional[int] = None,
    ) -> None:
        """
        Caches a normalized query embedding vector in Redis.
        """
        key = CacheKeys.query_embedding(provider, model_name, query_text)
        ttl = timeout or cls.DEFAULT_EMBEDDING_TTL
        try:
            cache.set(key, vector, timeout=ttl)
            logger.debug("Cached query embedding for key: %s (TTL: %ds)", key, ttl)
        except Exception as e:
            logger.warning("Error writing query embedding cache (%s): %s", key, str(e))

    # -------------------------------------------------------------------------
    # Workspace Role & Permissions Cache
    # -------------------------------------------------------------------------

    @classmethod
    def get_user_workspace_role(cls, user_id: str, workspace_id: str) -> Optional[str]:
        """
        Retrieves a cached workspace role (e.g., 'ADMIN', 'MEMBER', 'VIEWER', or '__NONE__').
        """
        key = CacheKeys.workspace_role(user_id, workspace_id)
        try:
            return cache.get(key)
        except Exception as e:
            logger.warning("Error reading workspace role cache (%s): %s", key, str(e))
            return None

    @classmethod
    def set_user_workspace_role(
        cls,
        user_id: str,
        workspace_id: str,
        role: str,
        timeout: Optional[int] = None,
    ) -> None:
        """
        Caches a user's role in a workspace.
        """
        key = CacheKeys.workspace_role(user_id, workspace_id)
        ttl = timeout or cls.DEFAULT_ROLE_TTL
        try:
            cache.set(key, role, timeout=ttl)
        except Exception as e:
            logger.warning("Error setting workspace role cache (%s): %s", key, str(e))

    @classmethod
    def invalidate_user_workspace_role(cls, user_id: str, workspace_id: str) -> None:
        """
        Invalidates cached role for a user in a workspace.
        """
        key = CacheKeys.workspace_role(user_id, workspace_id)
        try:
            cache.delete(key)
            logger.debug("Invalidated role cache: %s", key)
        except Exception as e:
            logger.warning("Error invalidating role cache (%s): %s", key, str(e))

    # -------------------------------------------------------------------------
    # Workspace Detail Cache
    # -------------------------------------------------------------------------

    @classmethod
    def get_workspace_detail(cls, workspace_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves serialized workspace details if cached.
        """
        key = CacheKeys.workspace_detail(workspace_id)
        try:
            return cache.get(key)
        except Exception as e:
            logger.warning("Error reading workspace detail cache: %s", str(e))
            return None

    @classmethod
    def set_workspace_detail(cls, workspace_id: str, data: Dict[str, Any], timeout: Optional[int] = None) -> None:
        """
        Caches serialized workspace details.
        """
        key = CacheKeys.workspace_detail(workspace_id)
        ttl = timeout or cls.DEFAULT_WS_DETAIL_TTL
        try:
            cache.set(key, data, timeout=ttl)
        except Exception as e:
            logger.warning("Error writing workspace detail cache: %s", str(e))

    @classmethod
    def invalidate_workspace_detail(cls, workspace_id: str) -> None:
        """
        Invalidates cached workspace details.
        """
        key = CacheKeys.workspace_detail(workspace_id)
        try:
            cache.delete(key)
        except Exception as e:
            logger.warning("Error invalidating workspace detail cache: %s", str(e))

    # -------------------------------------------------------------------------
    # Workspace Documents & Members List Cache
    # -------------------------------------------------------------------------

    DEFAULT_LIST_TTL = 300  # 5 minutes

    @classmethod
    def get_workspace_documents(cls, workspace_id: str) -> Optional[List[Dict[str, Any]]]:
        """Retrieves cached workspace document list."""
        key = CacheKeys.workspace_documents(workspace_id)
        try:
            return cache.get(key)
        except Exception as e:
            logger.warning("Error reading workspace documents cache: %s", str(e))
            return None

    @classmethod
    def set_workspace_documents(cls, workspace_id: str, data: List[Dict[str, Any]], timeout: Optional[int] = None) -> None:
        """Caches workspace document list."""
        key = CacheKeys.workspace_documents(workspace_id)
        ttl = timeout or cls.DEFAULT_LIST_TTL
        try:
            cache.set(key, data, timeout=ttl)
        except Exception as e:
            logger.warning("Error writing workspace documents cache: %s", str(e))

    @classmethod
    def invalidate_workspace_documents(cls, workspace_id: str) -> None:
        """Invalidates cached workspace document list."""
        key = CacheKeys.workspace_documents(workspace_id)
        try:
            cache.delete(key)
        except Exception as e:
            logger.warning("Error invalidating workspace documents cache: %s", str(e))

    @classmethod
    def get_workspace_members(cls, workspace_id: str) -> Optional[List[Dict[str, Any]]]:
        """Retrieves cached workspace members list."""
        key = CacheKeys.workspace_members(workspace_id)
        try:
            return cache.get(key)
        except Exception as e:
            logger.warning("Error reading workspace members cache: %s", str(e))
            return None

    @classmethod
    def set_workspace_members(cls, workspace_id: str, data: List[Dict[str, Any]], timeout: Optional[int] = None) -> None:
        """Caches workspace members list."""
        key = CacheKeys.workspace_members(workspace_id)
        ttl = timeout or cls.DEFAULT_LIST_TTL
        try:
            cache.set(key, data, timeout=ttl)
        except Exception as e:
            logger.warning("Error writing workspace members cache: %s", str(e))

    @classmethod
    def invalidate_workspace_members(cls, workspace_id: str) -> None:
        """Invalidates cached workspace members list."""
        key = CacheKeys.workspace_members(workspace_id)
        try:
            cache.delete(key)
        except Exception as e:
            logger.warning("Error invalidating workspace members cache: %s", str(e))
