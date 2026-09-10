"""
Context Builder & Token Budget Manager.
Constructs structured, anti-injection-hardened prompt contexts with dynamic token trimming.
Prioritizes high-similarity chunks and recent conversation history within strict token budgets.
"""
import logging
from typing import List, Tuple, Dict, Any, Optional
from django.conf import settings

from apps.chat.models import Message, MessageRole
from apps.chat.services.prompt_manager import PromptManager
from apps.documents.services.vector_search import SearchResult

logger = logging.getLogger(__name__)


class ContextBuilder:
    """
    Constructs the prompt context within a strict token budget.
    Ensures that context limits are never exceeded by trimming low-scoring chunks and older history.
    """

    def __init__(
        self,
        max_context_tokens: Optional[int] = None,
        max_history_turns: Optional[int] = None,
    ):
        self.max_context_tokens = max_context_tokens or getattr(
            settings, "RAG_MAX_CONTEXT_TOKENS", 3072
        )
        self.max_history_turns = max_history_turns or getattr(
            settings, "RAG_MAX_HISTORY_TURNS", 5
        )

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """
        Fast token estimation for English text (~4 chars per token).
        """
        if not text:
            return 0
        return max(1, len(text) // 4)

    def build_context(
        self,
        query: str,
        retrieved_chunks: List[SearchResult],
        conversation_messages: Optional[List[Message]] = None,
    ) -> Tuple[str, str, List[SearchResult]]:
        """
        Builds the system prompt and user context prompt with token budgeting.

        Args:
            query: User prompt text.
            retrieved_chunks: Candidate SearchResult objects from VectorSearchService.
            conversation_messages: Ordered list of previous Message instances.

        Returns:
            Tuple[str, str, List[SearchResult]]:
                - system_prompt
                - user_prompt
                - budgeted_chunks (subset of retrieved_chunks that fit in budget with 1-based index)
        """
        system_prompt = PromptManager.get_system_prompt()
        system_tokens = self.estimate_tokens(system_prompt)
        query_tokens = self.estimate_tokens(query)

        # Budget remaining for chunks + history
        remaining_budget = max(200, self.max_context_tokens - (system_tokens + query_tokens))

        # 1. Budget Conversation History (allocate at most 30% of remaining budget to history)
        history_budget = int(remaining_budget * 0.30)
        formatted_history, history_tokens = self._format_history(
            conversation_messages, history_budget
        )

        # 2. Budget Document Chunks (allocate remaining tokens to chunks)
        chunk_budget = remaining_budget - history_tokens
        budgeted_chunks = self._budget_chunks(retrieved_chunks, chunk_budget)

        # 3. Format Chunks into XML Context
        formatted_context_parts = []
        for idx, chunk in enumerate(budgeted_chunks, start=1):
            formatted_source = PromptManager.format_source_chunk(
                index=idx,
                document_title=chunk.document_title,
                section_header=chunk.section_header,
                page_number=chunk.page_number,
                content=chunk.content,
            )
            formatted_context_parts.append(formatted_source)

        context_str = "\n\n".join(formatted_context_parts)
        if not context_str:
            context_str = "No reference documents found."

        # 4. Compile User Prompt
        user_prompt = PromptManager.compile_user_prompt(
            context=context_str,
            question=query,
            history=formatted_history,
        )

        return system_prompt, user_prompt, budgeted_chunks

    def _budget_chunks(
        self,
        chunks: List[SearchResult],
        budget_tokens: int,
    ) -> List[SearchResult]:
        """
        Selects candidate chunks that fit within the token budget.
        Sorted by descending similarity score; drops lowest scoring chunks if budget exceeded.
        """
        if not chunks:
            return []

        # Sort by similarity score descending (highest quality first)
        sorted_chunks = sorted(chunks, key=lambda c: c.similarity_score, reverse=True)

        selected = []
        current_tokens = 0

        for chunk in sorted_chunks:
            chunk_tokens = self.estimate_tokens(chunk.content) + 30  # +30 for XML tags
            if current_tokens + chunk_tokens <= budget_tokens:
                selected.append(chunk)
                current_tokens += chunk_tokens
            else:
                logger.debug(
                    "Trimming chunk %s (score=%.3f) to fit token budget (%d/%d tokens used)",
                    chunk.chunk_id,
                    chunk.similarity_score,
                    current_tokens,
                    budget_tokens,
                )

        # Re-sort selected chunks by original document flow (chunk_index) for coherent reading
        selected.sort(key=lambda c: (c.document_id, c.chunk_index))
        return selected

    def _format_history(
        self,
        messages: Optional[List[Message]],
        budget_tokens: int,
    ) -> Tuple[str, int]:
        """
        Formats recent conversation history, windowed to the latest N turns and budget.
        """
        if not messages:
            return "", 0

        # Filter out system messages, keep user & assistant turns
        dialog_messages = [
            m for m in messages if m.role in [MessageRole.USER, MessageRole.ASSISTANT]
        ]
        # Keep at most max_history_turns
        recent_messages = dialog_messages[-self.max_history_turns :]

        history_lines = []
        total_tokens = 0

        # Process from newest to oldest for token budgeting
        for m in reversed(recent_messages):
            speaker = "User" if m.role == MessageRole.USER else "Assistant"
            line = f"{speaker}: {m.content.strip()}"
            line_tokens = self.estimate_tokens(line)

            if total_tokens + line_tokens <= budget_tokens:
                history_lines.insert(0, line)
                total_tokens += line_tokens
            else:
                break

        if not history_lines:
            return "", 0

        history_block = "Previous Conversation:\n" + "\n".join(history_lines) + "\n"
        return history_block, self.estimate_tokens(history_block)
