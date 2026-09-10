"""
Citation Parsing, Sanitization & Output Validation Service.
Extracts bracketed citations ([1], [2]), drops hallucinated out-of-bounds indices,
cleans leaked markup tags, and provides reference fallbacks.
"""
import re
import logging
from typing import List, Dict, Any, Tuple, Optional
from apps.documents.services.vector_search import SearchResult

logger = logging.getLogger(__name__)


class CitationValidator:
    """
    Validates, sanitizes, and extracts citations from generated LLM responses.
    Prevents hallucinated out-of-bounds citations and ensures verifiable source attribution.
    """

    CITATION_PATTERN = re.compile(r"\[(\d+)\]")
    LEAKED_XML_PATTERN = re.compile(r"<\/?(?:context|source)[^>]*>|<!\[CDATA\[|\]\]>", re.IGNORECASE)

    @classmethod
    def sanitize_and_extract_citations(
        cls,
        raw_text: str,
        budgeted_chunks: List[SearchResult],
        min_fallback_similarity: float = 0.50,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Sanitizes the generated response text and extracts valid source metadata.

        Args:
            raw_text: Raw output string from LLM.
            budgeted_chunks: List of SearchResult chunks provided to the LLM (1-indexed).
            min_fallback_similarity: Minimum score to attach implicit source if citations missing.

        Returns:
            Tuple[str, List[Dict[str, Any]]]:
                - Cleaned response text with invalid citation numbers stripped.
                - List of source citation dicts matching cited indices.
        """
        if not raw_text:
            return "", []

        # 1. Clean leaked XML/CDATA tags
        clean_text = cls.LEAKED_XML_PATTERN.sub("", raw_text).strip()

        # 2. Extract and validate citation indices
        num_sources = len(budgeted_chunks)
        cited_indices = set()

        def validate_citation_match(match):
            idx = int(match.group(1))
            # Valid if 1 <= idx <= num_sources
            if 1 <= idx <= num_sources:
                cited_indices.add(idx)
                return f"[{idx}]"
            else:
                # Out of bounds citation (e.g. [7] when only 3 sources provided) -> Strip it!
                logger.warning("Dropping hallucinated out-of-bounds citation [%d] (max=%d)", idx, num_sources)
                return ""

        sanitized_text = cls.CITATION_PATTERN.sub(validate_citation_match, clean_text)

        # 3. Clean up formatting artifacts (e.g. duplicate spaces or empty double brackets)
        sanitized_text = re.sub(r"\[\s*\]", "", sanitized_text)
        sanitized_text = re.sub(r"[ \t]+", " ", sanitized_text).strip()

        # 4. Build Citation Source Metadata Records
        sources: List[Dict[str, Any]] = []

        if cited_indices:
            for idx in sorted(cited_indices):
                chunk = budgeted_chunks[idx - 1]
                snippet = chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content
                sources.append({
                    "citation_index": idx,
                    "chunk_id": chunk.chunk_id,
                    "document_id": chunk.document_id,
                    "document_title": chunk.document_title,
                    "original_filename": chunk.original_filename,
                    "section_header": chunk.section_header,
                    "page_number": chunk.page_number,
                    "similarity_score": round(chunk.similarity_score, 4),
                    "snippet": snippet,
                })
        elif budgeted_chunks and budgeted_chunks[0].similarity_score >= min_fallback_similarity:
            # Fallback: Model didn't output bracketed tags, but top-1 chunk was highly relevant.
            # Attach top chunk as reference source.
            top_chunk = budgeted_chunks[0]
            snippet = top_chunk.content[:200] + "..." if len(top_chunk.content) > 200 else top_chunk.content
            sources.append({
                "citation_index": 1,
                "chunk_id": top_chunk.chunk_id,
                "document_id": top_chunk.document_id,
                "document_title": top_chunk.document_title,
                "original_filename": top_chunk.original_filename,
                "section_header": top_chunk.section_header,
                "page_number": top_chunk.page_number,
                "similarity_score": round(top_chunk.similarity_score, 4),
                "snippet": snippet,
            })

        return sanitized_text, sources
