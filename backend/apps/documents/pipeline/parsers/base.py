"""
Base Parser Interface and Data Structures for Document Processing Pipeline.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import os


@dataclass
class ParsedBlock:
    """
    Represents a discrete structural section or page of extracted text.
    """
    content: str
    page_number: Optional[int] = None
    section_header: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ParsedDocument:
    """
    Standardized parsed document structure containing all extracted blocks
    and overall metadata.
    """
    blocks: List[ParsedBlock]
    total_pages: Optional[int] = None
    char_count: int = 0
    word_count: int = 0
    title: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def full_text(self) -> str:
        """
        Returns all parsed blocks joined by double newlines.
        """
        return "\n\n".join(b.content for b in self.blocks if b.content.strip())


class BaseParser(ABC):
    """
    Abstract Base Class for all file-type specific parsers.
    """

    @abstractmethod
    def parse(self, file_path_or_obj, original_filename: str = "") -> ParsedDocument:
        """
        Extract structured text blocks from a file.

        Args:
            file_path_or_obj: File path string or file-like object / bytes.
            original_filename: Name of the uploaded file for format deduction.

        Returns:
            ParsedDocument with structured ParsedBlock elements.
        """
        pass
