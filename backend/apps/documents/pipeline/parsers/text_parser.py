"""
Text and Markdown Document Parser.
Extracts structured sections from .txt and .md files based on markdown headers and paragraph breaks.
"""
import re
import io
import logging
from typing import Union, BinaryIO
from apps.documents.pipeline.parsers.base import BaseParser, ParsedDocument, ParsedBlock

logger = logging.getLogger(__name__)


class TextParser(BaseParser):
    """
    Parser for Plain Text (.txt) and CSV files.
    """

    def parse(self, file_path_or_obj: Union[str, BinaryIO, bytes], original_filename: str = "") -> ParsedDocument:
        raw_text = self._read_text(file_path_or_obj)
        clean_text = raw_text.strip()
        if not clean_text:
            return ParsedDocument(blocks=[], total_pages=None, char_count=0, word_count=0)

        # Split into logical paragraphs
        paragraphs = [p.strip() for p in re.split(r'\n\s*\n', clean_text) if p.strip()]
        blocks = []
        total_chars = 0
        total_words = 0

        for idx, para in enumerate(paragraphs):
            c_count = len(para)
            w_count = len(para.split())
            total_chars += c_count
            total_words += w_count
            blocks.append(
                ParsedBlock(
                    content=para,
                    page_number=None,
                    section_header=f"Section {idx + 1}",
                    metadata={"paragraph_index": idx}
                )
            )

        return ParsedDocument(
            blocks=blocks,
            total_pages=None,
            char_count=total_chars,
            word_count=total_words,
            metadata={"filename": original_filename}
        )

    def _read_text(self, file_path_or_obj: Union[str, BinaryIO, bytes]) -> str:
        if isinstance(file_path_or_obj, bytes):
            return file_path_or_obj.decode('utf-8', errors='replace')
        elif isinstance(file_path_or_obj, str):
            with open(file_path_or_obj, 'r', encoding='utf-8', errors='replace') as f:
                return f.read()
        else:
            if hasattr(file_path_or_obj, 'seek'):
                file_path_or_obj.seek(0)
            content = file_path_or_obj.read()
            if isinstance(content, bytes):
                return content.decode('utf-8', errors='replace')
            return str(content)


class MarkdownParser(BaseParser):
    """
    Parser for Markdown (.md) documents.
    Detects markdown headings (`#`, `##`, `###`) to create structured section blocks.
    """

    HEADING_REGEX = re.compile(r'^(#{1,6})\s+(.*)$', re.MULTILINE)

    def parse(self, file_path_or_obj: Union[str, BinaryIO, bytes], original_filename: str = "") -> ParsedDocument:
        raw_text = TextParser()._read_text(file_path_or_obj)
        clean_text = raw_text.strip()
        if not clean_text:
            return ParsedDocument(blocks=[], total_pages=None, char_count=0, word_count=0)

        lines = clean_text.split('\n')
        blocks = []
        current_header = ""
        current_lines = []
        doc_title = None
        total_chars = 0
        total_words = 0

        def flush_block():
            nonlocal current_lines, total_chars, total_words
            if current_lines:
                block_content = "\n".join(current_lines).strip()
                if block_content:
                    c_count = len(block_content)
                    w_count = len(block_content.split())
                    total_chars += c_count
                    total_words += w_count
                    blocks.append(
                        ParsedBlock(
                            content=block_content,
                            page_number=None,
                            section_header=current_header or "Introduction",
                            metadata={"section_header": current_header or "Introduction"}
                        )
                    )
                current_lines = []

        for line in lines:
            header_match = self.HEADING_REGEX.match(line)
            if header_match:
                flush_block()
                level = len(header_match.group(1))
                heading_text = header_match.group(2).strip()
                if level == 1 and not doc_title:
                    doc_title = heading_text
                current_header = heading_text
                current_lines.append(line)
            else:
                current_lines.append(line)

        flush_block()

        # If no heading blocks were created (e.g. single block text)
        if not blocks and clean_text:
            total_chars = len(clean_text)
            total_words = len(clean_text.split())
            blocks.append(
                ParsedBlock(
                    content=clean_text,
                    page_number=None,
                    section_header="Content",
                    metadata={}
                )
            )

        return ParsedDocument(
            blocks=blocks,
            total_pages=None,
            char_count=total_chars,
            word_count=total_words,
            title=doc_title,
            metadata={"filename": original_filename}
        )
