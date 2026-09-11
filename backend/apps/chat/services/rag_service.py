"""
Master RAG Orchestrator Service.
Coordinates Vector Retrieval, Token Budgeting, Prompt Compilation (Langfuse/Fallback),
LLM Generation (Sync and SSE Streaming), Citation Sanitization, and Database Persistence.
"""
import time
import json
import logging
from typing import Tuple, List, Dict, Any, Iterator, Optional
from django.db import transaction
from django.conf import settings

from apps.chat.models import Conversation, Message, MessageRole, MessageSource
from apps.chat.services.context_builder import ContextBuilder
from apps.chat.services.citation_validator import CitationValidator
from apps.chat.services.prompt_manager import PromptManager
from apps.chat.services.rate_limiter import ChatRateLimiter
from apps.chat.pipeline.llm.factory import LLMProviderFactory
from apps.documents.services.vector_search import VectorSearchService
from apps.common.cache import CacheService

logger = logging.getLogger(__name__)


class RAGService:
    """
    Orchestrates the complete end-to-end RAG lifecycle for conversations.
    """

    def __init__(
        self,
        vector_search_service: Optional[VectorSearchService] = None,
        context_builder: Optional[ContextBuilder] = None,
    ):
        self.vector_search = vector_search_service or VectorSearchService()
        self.context_builder = context_builder or ContextBuilder()

    def process_message_sync(
        self,
        conversation: Conversation,
        user,
        query_text: str,
    ) -> Tuple[Message, List[Dict[str, Any]]]:
        """
        Executes a complete synchronous RAG turn.
        Saves user query, retrieves chunks, prompts LLM, sanitizes citations, and saves assistant response.

        Returns:
            Tuple[Message, List[Dict[str, Any]]]: Saved assistant Message and list of citation dicts.
        """
        clean_query = query_text.strip()
        if not clean_query:
            raise ValueError("Query text cannot be empty.")

        # 1. Rate Limiting & Guardrails
        ChatRateLimiter.check_rate_limits(str(user.id), str(conversation.workspace_id))
        ChatRateLimiter.check_conversation_capacity(conversation)

        # 2. Persist User Message
        user_msg = Message.objects.create(
            conversation=conversation,
            role=MessageRole.USER,
            content=clean_query,
        )

        # Update conversation title if this is the first turn
        if conversation.title in ["New Conversation", ""]:
            title_preview = clean_query[:40] + ("..." if len(clean_query) > 40 else "")
            conversation.title = title_preview
            conversation.save(update_fields=["title", "updated_at"])

        # 3. Check Multi-Dimensional RAG Answer Cache
        ws_id = str(conversation.workspace_id)
        kver = CacheService.get_knowledge_version(ws_id)
        prompt_ver = PromptManager.get_prompt_version_hash()
        provider = LLMProviderFactory.get_provider()
        model_id = provider.get_model_name()

        cached_data = CacheService.get_rag_answer(
            workspace_id=ws_id,
            knowledge_ver=kver,
            prompt_ver=prompt_ver,
            model_id=model_id,
            query_text=clean_query,
        )

        if cached_data is not None:
            logger.info("Serving RAG answer from Redis cache for workspace %s (kver=%d, prompt=%s, model=%s)", ws_id, kver, prompt_ver, model_id)
            with transaction.atomic():
                assistant_msg = Message.objects.create(
                    conversation=conversation,
                    role=MessageRole.ASSISTANT,
                    content=cached_data["content"],
                    prompt_tokens=cached_data.get("prompt_tokens", 0),
                    completion_tokens=cached_data.get("completion_tokens", 0),
                    total_tokens=cached_data.get("total_tokens", 0),
                    latency_ms=cached_data.get("latency_ms", 15),
                    model_name=model_id,
                    error_message="",
                )
                for cit in cached_data.get("citations", []):
                    MessageSource.objects.create(
                        message=assistant_msg,
                        chunk_id=cit["chunk_id"],
                        citation_index=cit["citation_index"],
                        similarity_score=cit["similarity_score"],
                        document_title=cit["document_title"],
                        original_filename=cit.get("original_filename", ""),
                        section_header=cit.get("section_header", ""),
                        page_number=cit.get("page_number"),
                        snippet=cit.get("snippet", ""),
                    )
                conversation.save(update_fields=["updated_at"])
            return assistant_msg, cached_data.get("citations", [])

        # 4. Vector Similarity Search (pgvector)
        top_k = getattr(settings, "RAG_TOP_K", 5)
        min_score = getattr(settings, "RAG_MIN_SIMILARITY_SCORE", 0.40)
        retrieved_chunks = self.vector_search.search(
            workspace=conversation.workspace,
            query_text=clean_query,
            top_k=top_k,
            min_score=min_score,
        )

        # 5. Context Construction & Token Budgeting
        previous_messages = list(conversation.messages.exclude(id=user_msg.id).order_by("created_at"))
        system_prompt, user_prompt, budgeted_chunks = self.context_builder.build_context(
            query=clean_query,
            retrieved_chunks=retrieved_chunks,
            conversation_messages=previous_messages,
        )

        # 6. LLM Provider Execution
        t0 = time.perf_counter()
        try:
            llm_response = provider.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
            raw_content = llm_response.content
            error_msg = ""
        except Exception as e:
            logger.error("LLM generation failed for conversation %s: %s", conversation.id, str(e), exc_info=True)
            raw_content = "I apologize, but I am currently unable to answer your request due to a temporary service disruption. Please try again in a few moments."
            error_msg = str(e)
            llm_response = None

        latency_ms = int((time.perf_counter() - t0) * 1000)

        # 7. Citation Sanitization & Validation
        sanitized_content, citation_data_list = CitationValidator.sanitize_and_extract_citations(
            raw_text=raw_content,
            budgeted_chunks=budgeted_chunks,
        )

        # 8. Persist Assistant Message & Source Citations Atomically
        with transaction.atomic():
            assistant_msg = Message.objects.create(
                conversation=conversation,
                role=MessageRole.ASSISTANT,
                content=sanitized_content,
                prompt_tokens=llm_response.prompt_tokens if llm_response else 0,
                completion_tokens=llm_response.completion_tokens if llm_response else 0,
                total_tokens=llm_response.total_tokens if llm_response else 0,
                latency_ms=latency_ms,
                model_name=provider.get_model_name(),
                error_message=error_msg,
            )

            # Persist sources
            for cit in citation_data_list:
                MessageSource.objects.create(
                    message=assistant_msg,
                    chunk_id=cit["chunk_id"],
                    citation_index=cit["citation_index"],
                    similarity_score=cit["similarity_score"],
                    document_title=cit["document_title"],
                    original_filename=cit.get("original_filename", ""),
                    section_header=cit.get("section_header", ""),
                    page_number=cit.get("page_number"),
                    snippet=cit.get("snippet", ""),
                )

            # Touch conversation timestamp
            conversation.save(update_fields=["updated_at"])

        # 9. Warm RAG Cache if generation succeeded
        if llm_response and not error_msg:
            CacheService.set_rag_answer(
                workspace_id=ws_id,
                knowledge_ver=kver,
                prompt_ver=prompt_ver,
                model_id=model_id,
                query_text=clean_query,
                payload={
                    "content": sanitized_content,
                    "citations": citation_data_list,
                    "prompt_tokens": llm_response.prompt_tokens,
                    "completion_tokens": llm_response.completion_tokens,
                    "total_tokens": llm_response.total_tokens,
                    "latency_ms": latency_ms,
                },
            )

        return assistant_msg, citation_data_list

    def process_message_stream(
        self,
        conversation: Conversation,
        user,
        query_text: str,
    ) -> Iterator[str]:
        """
        Executes an SSE streaming RAG turn.
        Yields events:
            event: metadata\ndata: {...}\n\n
            event: token\ndata: {"delta": "..."}\n\n
            event: citations\ndata: [...]\n\n
            event: done\ndata: {"message_id": "...", ...}\n\n
        """
        clean_query = query_text.strip()
        if not clean_query:
            yield f"event: error\ndata: {json.dumps({'error': 'Query text cannot be empty.'})}\n\n"
            return

        # 1. Rate Limiting & Guardrails
        try:
            ChatRateLimiter.check_rate_limits(str(user.id), str(conversation.workspace_id))
            ChatRateLimiter.check_conversation_capacity(conversation)
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
            return

        # 2. Persist User Message
        user_msg = Message.objects.create(
            conversation=conversation,
            role=MessageRole.USER,
            content=clean_query,
        )

        if conversation.title in ["New Conversation", ""]:
            title_preview = clean_query[:40] + ("..." if len(clean_query) > 40 else "")
            conversation.title = title_preview
            conversation.save(update_fields=["title", "updated_at"])

        # Initial metadata event
        yield f"event: metadata\ndata: {json.dumps({'conversation_id': str(conversation.id), 'user_message_id': str(user_msg.id)})}\n\n"

        # 3. Check Multi-Dimensional RAG Answer Cache
        ws_id = str(conversation.workspace_id)
        kver = CacheService.get_knowledge_version(ws_id)
        prompt_ver = PromptManager.get_prompt_version_hash()
        provider = LLMProviderFactory.get_provider()
        model_id = provider.get_model_name()

        cached_data = CacheService.get_rag_answer(
            workspace_id=ws_id,
            knowledge_ver=kver,
            prompt_ver=prompt_ver,
            model_id=model_id,
            query_text=clean_query,
        )

        if cached_data is not None:
            logger.info("Streaming RAG answer from Redis cache for workspace %s (kver=%d, prompt=%s, model=%s)", ws_id, kver, prompt_ver, model_id)
            cached_content = cached_data["content"]
            chunk_size = 24
            for i in range(0, len(cached_content), chunk_size):
                token_chunk = cached_content[i : i + chunk_size]
                yield f"event: token\ndata: {json.dumps({'delta': token_chunk})}\n\n"

            with transaction.atomic():
                assistant_msg = Message.objects.create(
                    conversation=conversation,
                    role=MessageRole.ASSISTANT,
                    content=cached_content,
                    prompt_tokens=cached_data.get("prompt_tokens", 0),
                    completion_tokens=cached_data.get("completion_tokens", 0),
                    total_tokens=cached_data.get("total_tokens", 0),
                    latency_ms=cached_data.get("latency_ms", 15),
                    model_name=model_id,
                    error_message="",
                )
                for cit in cached_data.get("citations", []):
                    MessageSource.objects.create(
                        message=assistant_msg,
                        chunk_id=cit["chunk_id"],
                        citation_index=cit["citation_index"],
                        similarity_score=cit["similarity_score"],
                        document_title=cit["document_title"],
                        original_filename=cit.get("original_filename", ""),
                        section_header=cit.get("section_header", ""),
                        page_number=cit.get("page_number"),
                        snippet=cit.get("snippet", ""),
                    )
                conversation.save(update_fields=["updated_at"])

            yield f"event: citations\ndata: {json.dumps(cached_data.get('citations', []))}\n\n"
            yield f"event: done\ndata: {json.dumps({'message_id': str(assistant_msg.id), 'latency_ms': 15})}\n\n"
            return

        # 4. Vector Similarity Search
        top_k = getattr(settings, "RAG_TOP_K", 5)
        min_score = getattr(settings, "RAG_MIN_SIMILARITY_SCORE", 0.40)
        retrieved_chunks = self.vector_search.search(
            workspace=conversation.workspace,
            query_text=clean_query,
            top_k=top_k,
            min_score=min_score,
        )

        # 5. Context Construction
        previous_messages = list(conversation.messages.exclude(id=user_msg.id).order_by("created_at"))
        system_prompt, user_prompt, budgeted_chunks = self.context_builder.build_context(
            query=clean_query,
            retrieved_chunks=retrieved_chunks,
            conversation_messages=previous_messages,
        )

        # 6. Stream from LLM Provider
        accumulated_parts = []
        t0 = time.perf_counter()
        error_msg = ""

        try:
            for token in provider.generate_stream(system_prompt=system_prompt, user_prompt=user_prompt):
                accumulated_parts.append(token)
                yield f"event: token\ndata: {json.dumps({'delta': token})}\n\n"
        except Exception as e:
            logger.error("LLM streaming error for conversation %s: %s", conversation.id, str(e), exc_info=True)
            error_msg = str(e)
            fallback_text = "\n[Generation interrupted due to a temporary service issue.]"
            accumulated_parts.append(fallback_text)
            yield f"event: token\ndata: {json.dumps({'delta': fallback_text})}\n\n"

        latency_ms = int((time.perf_counter() - t0) * 1000)
        raw_content = "".join(accumulated_parts)

        # 7. Citation Sanitization
        sanitized_content, citation_data_list = CitationValidator.sanitize_and_extract_citations(
            raw_text=raw_content,
            budgeted_chunks=budgeted_chunks,
        )

        # 8. Persist Assistant Message & Sources
        with transaction.atomic():
            assistant_msg = Message.objects.create(
                conversation=conversation,
                role=MessageRole.ASSISTANT,
                content=sanitized_content,
                prompt_tokens=len(user_prompt) // 4,
                completion_tokens=len(sanitized_content) // 4,
                total_tokens=(len(user_prompt) + len(sanitized_content)) // 4,
                latency_ms=latency_ms,
                model_name=provider.get_model_name(),
                error_message=error_msg,
            )

            for cit in citation_data_list:
                MessageSource.objects.create(
                    message=assistant_msg,
                    chunk_id=cit["chunk_id"],
                    citation_index=cit["citation_index"],
                    similarity_score=cit["similarity_score"],
                    document_title=cit["document_title"],
                    original_filename=cit.get("original_filename", ""),
                    section_header=cit.get("section_header", ""),
                    page_number=cit.get("page_number"),
                    snippet=cit.get("snippet", ""),
                )

            conversation.save(update_fields=["updated_at"])

        # 9. Warm RAG Cache if generation was clean
        if not error_msg and sanitized_content:
            CacheService.set_rag_answer(
                workspace_id=ws_id,
                knowledge_ver=kver,
                prompt_ver=prompt_ver,
                model_id=model_id,
                query_text=clean_query,
                payload={
                    "content": sanitized_content,
                    "citations": citation_data_list,
                    "prompt_tokens": len(user_prompt) // 4,
                    "completion_tokens": len(sanitized_content) // 4,
                    "total_tokens": (len(user_prompt) + len(sanitized_content)) // 4,
                    "latency_ms": latency_ms,
                },
            )

        # Yield citations and completion done event
        yield f"event: citations\ndata: {json.dumps(citation_data_list)}\n\n"
        yield f"event: done\ndata: {json.dumps({'message_id': str(assistant_msg.id), 'latency_ms': latency_ms})}\n\n"

