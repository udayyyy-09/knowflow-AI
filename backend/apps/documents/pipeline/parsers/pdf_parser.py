"""
PDF Document Parser using pypdf.
Extracts text page-by-page and preserves page numbers and layout metadata.
"""
import io
import logging
from typing import Union, BinaryIO
from pypdf import PdfReader
from apps.documents.pipeline.parsers.base import BaseParser, ParsedDocument, ParsedBlock

logger = logging.getLogger(__name__)


class PDFParser(BaseParser):
    """
    Parser for PDF documents. Extracts text with exact page numbers.
    """

    def parse(self, file_path_or_obj: Union[str, BinaryIO, bytes], original_filename: str = "") -> ParsedDocument:
        """
        Parses a PDF file and returns structured blocks with 1-indexed page numbers.
        """
        if isinstance(file_path_or_obj, bytes):
            stream = io.BytesIO(file_path_or_obj)
        elif isinstance(file_path_or_obj, str):
            stream = open(file_path_or_obj, 'rb')
        else:
            stream = file_path_or_obj
            if hasattr(stream, 'seek'):
                stream.seek(0)

        blocks = []
        total_chars = 0
        total_words = 0
        total_pages = 0

        try:
            reader = PdfReader(stream)
            total_pages = len(reader.pages)

            for page_idx, page in enumerate(reader.pages):
                page_number = page_idx + 1
                try:
                    text = page.extract_text() or ""
                except Exception as ex:
                    logger.warning("Failed extracting text from page %d of %s: %s", page_number, original_filename, ex)
                    text = ""

                clean_text = text.strip()
                if clean_text:
                    char_count = len(clean_text)
                    word_count = len(clean_text.split())
                    total_chars += char_count
                    total_words += word_count

                    blocks.append(
                        ParsedBlock(
                            content=clean_text,
                            page_number=page_number,
                            section_header=f"Page {page_number}",
                            metadata={
                                "page_number": page_number,
                                "total_pages": total_pages,
                                "char_count": char_count,
                                "word_count": word_count,
                            }
                        )
                    )

            # Extract doc metadata if available
            doc_metadata = {}
            if reader.metadata:
                for k, v in reader.metadata.items():
                    if isinstance(v, (str, int, float, bool)):
                        doc_metadata[str(k).lstrip('/')] = v

            return ParsedDocument(
                blocks=blocks,
                total_pages=total_pages,
                char_count=total_chars,
                word_count=total_words,
                title=doc_metadata.get("Title") or None,
                metadata=doc_metadata
            )
        finally:
            if isinstance(file_path_or_obj, str) and not stream.closed:
                stream.close()
