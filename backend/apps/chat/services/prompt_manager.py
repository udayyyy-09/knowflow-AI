"""
Prompt Management Service.
Primary: Fetches dynamic prompt templates from Langfuse Prompt CMS (with TTL caching).
Fallback: Seamlessly falls back to apps.chat.prompts static definitions if Langfuse is unavailable.
"""
import logging
from typing import Tuple, Dict, Any, Optional
from django.conf import settings
from django.core.cache import cache

from apps.chat.prompts import (
    DEFAULT_SYSTEM_PROMPT,
    DEFAULT_USER_CONTEXT_PROMPT,
    SOURCE_CHUNK_TEMPLATE,
)

logger = logging.getLogger(__name__)


class PromptManager:
    """
    Manages RAG system prompts and user query templates.
    Integrates with Langfuse for prompt versioning, observability, and zero-downtime updates,
    with an infallible local fallback.
    """

    CACHE_KEY_PREFIX = "knowflow:prompts:"
    DEFAULT_CACHE_TTL = 600  # 10 minutes

    _langfuse_client = None

    @classmethod
    def _get_langfuse_client(cls):
        """
        Initializes the Langfuse client if credentials are configured.
        """
        if cls._langfuse_client is None:
            pub_key = getattr(settings, "LANGFUSE_PUBLIC_KEY", "")
            sec_key = getattr(settings, "LANGFUSE_SECRET_KEY", "")
            host = getattr(settings, "LANGFUSE_HOST", "https://cloud.langfuse.com")

            if pub_key and sec_key:
                try:
                    from langfuse import Langfuse
                    cls._langfuse_client = Langfuse(
                        public_key=pub_key,
                        secret_key=sec_key,
                        host=host,
                    )
                    logger.info("Langfuse Prompt Management initialized with host: %s", host)
                except Exception as e:
                    logger.warning("Failed to initialize Langfuse client: %s", str(e))
                    cls._langfuse_client = None
        return cls._langfuse_client

    @classmethod
    def get_system_prompt(cls) -> str:
        """
        Retrieves the RAG system prompt.
        1. Checks cache.
        2. Tries Langfuse 'rag-system-prompt' (label='production').
        3. Falls back to DEFAULT_SYSTEM_PROMPT.
        """
        cache_key = f"{cls.CACHE_KEY_PREFIX}system"
        cached = cache.get(cache_key)
        if cached:
            return cached

        client = cls._get_langfuse_client()
        if client:
            # 1. Try dedicated 'rag-system-prompt'
            try:
                prompt = client.get_prompt(
                    "rag-system-prompt",
                    label="production",
                    cache_ttl_seconds=getattr(settings, "LANGFUSE_PROMPT_CACHE_TTL_SECONDS", cls.DEFAULT_CACHE_TTL),
                )
                compiled = prompt.compile()
                if compiled:
                    cache.set(cache_key, compiled, cls.DEFAULT_CACHE_TTL)
                    return compiled
            except Exception as e:
                logger.debug("Langfuse 'rag-system-prompt' not found: %s. Checking 'rag-pipeline-prompt'...", str(e))

            # 2. Try unified chat prompt 'rag-pipeline-prompt'
            try:
                prompt = client.get_prompt(
                    "rag-pipeline-prompt",
                    label="production",
                    cache_ttl_seconds=getattr(settings, "LANGFUSE_PROMPT_CACHE_TTL_SECONDS", cls.DEFAULT_CACHE_TTL),
                )
                compiled = prompt.compile()
                if isinstance(compiled, list):
                    sys_msg = next((m.get("content") for m in compiled if m.get("role") == "system"), None)
                    if sys_msg:
                        cache.set(cache_key, sys_msg, cls.DEFAULT_CACHE_TTL)
                        return sys_msg
                elif isinstance(compiled, str) and compiled:
                    cache.set(cache_key, compiled, cls.DEFAULT_CACHE_TTL)
                    return compiled
            except Exception as e:
                logger.warning(
                    "Langfuse fetch for 'rag-pipeline-prompt' failed (%s). Falling back to local prompts.py.",
                    str(e),
                )

        # Fallback
        cache.set(cache_key, DEFAULT_SYSTEM_PROMPT, cls.DEFAULT_CACHE_TTL)
        return DEFAULT_SYSTEM_PROMPT

    @classmethod
    def compile_user_prompt(
        cls,
        context: str,
        question: str,
        history: str = "",
    ) -> str:
        """
        Compiles the user context prompt with substituted variables.
        1. Tries Langfuse 'rag-user-prompt'.
        2. Tries Langfuse 'rag-pipeline-prompt' (extracting the user message).
        3. Falls back to DEFAULT_USER_CONTEXT_PROMPT.
        """
        client = cls._get_langfuse_client()
        if client:
            # 1. Try dedicated 'rag-user-prompt'
            try:
                prompt = client.get_prompt(
                    "rag-user-prompt",
                    label="production",
                    cache_ttl_seconds=getattr(settings, "LANGFUSE_PROMPT_CACHE_TTL_SECONDS", cls.DEFAULT_CACHE_TTL),
                )
                compiled = prompt.compile(
                    context=context,
                    question=question,
                    history=history,
                )
                if compiled:
                    return compiled
            except Exception as e:
                logger.debug("Langfuse 'rag-user-prompt' not found: %s. Checking 'rag-pipeline-prompt'...", str(e))

            # 2. Try unified chat prompt 'rag-pipeline-prompt'
            try:
                prompt = client.get_prompt(
                    "rag-pipeline-prompt",
                    label="production",
                    cache_ttl_seconds=getattr(settings, "LANGFUSE_PROMPT_CACHE_TTL_SECONDS", cls.DEFAULT_CACHE_TTL),
                )
                compiled = prompt.compile(
                    context=context,
                    question=question,
                    history=history,
                )
                if isinstance(compiled, list):
                    user_msg = next((m.get("content") for m in compiled if m.get("role") == "user"), None)
                    if user_msg:
                        return user_msg
                elif isinstance(compiled, str) and compiled:
                    return compiled
            except Exception as e:
                logger.warning(
                    "Langfuse fetch for 'rag-pipeline-prompt' failed (%s). Falling back to local template.",
                    str(e),
                )

        # Fallback template compilation
        template = DEFAULT_USER_CONTEXT_PROMPT
        compiled = template.replace("{{context}}", context)
        compiled = compiled.replace("{{question}}", question)
        compiled = compiled.replace("{{history}}", history if history else "")
        return compiled

    @classmethod
    def format_source_chunk(
        cls,
        index: int,
        document_title: str,
        section_header: str,
        page_number: Optional[int],
        content: str,
    ) -> str:
        """
        Formats a retrieved document chunk using the XML boundary template.
        """
        page_str = str(page_number) if page_number is not None else "N/A"
        clean_section = section_header or "General"
        template = SOURCE_CHUNK_TEMPLATE
        formatted = template.replace("{{index}}", str(index))
        formatted = formatted.replace("{{document_title}}", document_title)
        formatted = formatted.replace("{{section_header}}", clean_section)
        formatted = formatted.replace("{{page_number}}", page_str)
        formatted = formatted.replace("{{content}}", content.strip())
        return formatted

    @classmethod
    def clear_cache(cls):
        """Clears cached prompts (useful during tests or prompt redeployment)."""
        cache.delete(f"{cls.CACHE_KEY_PREFIX}system")
        cache.delete(f"{cls.CACHE_KEY_PREFIX}user")
