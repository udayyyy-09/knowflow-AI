"""
Parser Factory for resolving the appropriate parser by file extension or MIME type.
"""
import os
from typing import Optional
from apps.documents.models import DocumentFileType
from apps.documents.pipeline.parsers.base import BaseParser
from apps.documents.pipeline.parsers.pdf_parser import PDFParser
from apps.documents.pipeline.parsers.docx_parser import DOCXParser
from apps.documents.pipeline.parsers.text_parser import TextParser, MarkdownParser


class ParserFactory:
    """
    Factory to resolve parser implementations dynamically.
    """

    EXT_MAP = {
        '.pdf': PDFParser,
        '.docx': DOCXParser,
        '.doc': DOCXParser,
        '.txt': TextParser,
        '.csv': TextParser,
        '.md': MarkdownParser,
        '.markdown': MarkdownParser,
    }

    FILE_TYPE_MAP = {
        DocumentFileType.PDF: PDFParser,
        DocumentFileType.DOCX: DOCXParser,
        DocumentFileType.TXT: TextParser,
        DocumentFileType.CSV: TextParser,
        DocumentFileType.MD: MarkdownParser,
    }

    MIME_MAP = {
        'application/pdf': PDFParser,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': DOCXParser,
        'application/msword': DOCXParser,
        'text/plain': TextParser,
        'text/csv': TextParser,
        'text/markdown': MarkdownParser,
        'text/x-markdown': MarkdownParser,
    }

    @classmethod
    def get_parser(
        cls,
        filename: str = "",
        file_type: Optional[str] = None,
        mime_type: Optional[str] = None
    ) -> BaseParser:
        """
        Resolves the parser based on filename extension, file_type choice, or mime_type.
        Defaults to TextParser if unrecognized.
        """
        # 1. By explicit file_type
        if file_type and file_type in cls.FILE_TYPE_MAP:
            return cls.FILE_TYPE_MAP[file_type]()

        # 2. By file extension
        if filename:
            _, ext = os.path.splitext(filename.lower())
            if ext in cls.EXT_MAP:
                return cls.EXT_MAP[ext]()

        # 3. By MIME type
        if mime_type:
            cleaned_mime = mime_type.split(';')[0].strip().lower()
            if cleaned_mime in cls.MIME_MAP:
                return cls.MIME_MAP[cleaned_mime]()

        # Fallback default
        return TextParser()
