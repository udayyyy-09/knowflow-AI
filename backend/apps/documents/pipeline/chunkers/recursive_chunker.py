"""
Recursive Character Text Chunker with overlap and metadata preservation.
Breaks down structured document blocks into retrieval-optimized chunks for vector search.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from apps.documents.pipeline.parsers.base import ParsedDocument, ParsedBlock


@dataclass
class RawChunk:
    """
    Data container for a generated chunk before database persistence.
    """
    chunk_index: int
    content: str
    page_number: Optional[int] = None
    section_header: str = ""
    char_count: int = 0
    token_count_estimate: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


class RecursiveCharacterChunker:
    """
    Splits text recursively using a hierarchy of natural semantic boundaries:
    paragraphs (\n\n) -> lines (\n) -> sentences (. / ! / ?) -> clauses (; / ,) -> words ( ) -> characters.
    """

    DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", "! ", "? ", "; ", " ", ""]

    def __init__(
        self,
        chunk_size: int = 800,
        chunk_overlap: int = 150,
        separators: Optional[List[str]] = None,
        min_chunk_size: int = 50
    ):
        """
        Args:
            chunk_size: Target maximum characters per chunk (approx 150-200 tokens).
            chunk_overlap: Number of overlapping characters between consecutive chunks.
            separators: Hierarchy of split delimiters.
            min_chunk_size: Minimum characters to avoid trailing orphan fragments.
        """
        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be strictly less than chunk_size")

        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or self.DEFAULT_SEPARATORS
        self.min_chunk_size = min_chunk_size

    def chunk_document(self, parsed_doc: ParsedDocument, base_metadata: Optional[Dict[str, Any]] = None) -> List[RawChunk]:
        """
        Processes all blocks of a ParsedDocument into an ordered list of RawChunks.
        Preserves page numbers and section headers on each chunk.
        """
        base_meta = base_metadata or {}
        raw_chunks: List[RawChunk] = []
        global_chunk_idx = 0

        for block in parsed_doc.blocks:
            text = block.content.strip()
            if not text:
                continue

            block_splits = self._split_text(text, self.separators)

            # Merge smaller splits with overlap into target chunk_size
            merged_pieces = self._merge_splits(block_splits)

            for piece in merged_pieces:
                clean_piece = piece.strip()
                if len(clean_piece) < self.min_chunk_size and raw_chunks:
                    # Append small orphan to previous chunk if within size limits
                    prev_chunk = raw_chunks[-1]
                    if len(prev_chunk.content) + len(clean_piece) + 1 <= self.chunk_size * 1.3:
                        prev_chunk.content = f"{prev_chunk.content}\n{clean_piece}"
                        prev_chunk.char_count = len(prev_chunk.content)
                        prev_chunk.token_count_estimate = max(1, prev_chunk.char_count // 4)
                        continue

                if not clean_piece:
                    continue

                c_len = len(clean_piece)
                tok_estimate = max(1, c_len // 4)
                chunk_meta = {
                    **base_meta,
                    **block.metadata,
                    "section_header": block.section_header,
                    "page_number": block.page_number,
                }

                raw_chunks.append(
                    RawChunk(
                        chunk_index=global_chunk_idx,
                        content=clean_piece,
                        page_number=block.page_number,
                        section_header=block.section_header,
                        char_count=c_len,
                        token_count_estimate=tok_estimate,
                        metadata=chunk_meta
                    )
                )
                global_chunk_idx += 1

        # Re-index chunks sequentially in case of any coalescing
        for idx, ch in enumerate(raw_chunks):
            ch.chunk_index = idx

        return raw_chunks

    def _split_text(self, text: str, separators: List[str]) -> List[str]:
        """
        Recursively splits text using the first separator that appears in the text.
        """
        final_splits = []
        separator = separators[-1]
        new_separators = []

        for i, sep in enumerate(separators):
            if sep == "":
                separator = ""
                break
            if sep in text:
                separator = sep
                new_separators = separators[i + 1:]
                break

        splits = text.split(separator) if separator != "" else list(text)

        for s in splits:
            if not s:
                continue
            if len(s) > self.chunk_size and new_separators:
                nested_splits = self._split_text(s, new_separators)
                final_splits.extend(nested_splits)
            else:
                final_splits.append(s)

        return final_splits

    def _merge_splits(self, splits: List[str]) -> List[str]:
        """
        Merges small split pieces together until target chunk_size is reached,
        creating sliding windows with chunk_overlap.
        """
        docs = []
        current_doc = []
        total_len = 0

        for split in splits:
            s_len = len(split)
            if total_len + s_len > self.chunk_size and current_doc:
                doc_text = " ".join(current_doc)
                docs.append(doc_text)

                # Slide window back for overlap
                while total_len > self.chunk_overlap and current_doc:
                    popped = current_doc.pop(0)
                    total_len -= len(popped) + 1

            current_doc.append(split)
            total_len += s_len + 1

        if current_doc:
            doc_text = " ".join(current_doc)
            docs.append(doc_text)

        return docs
