"""
Abstract Base Class for LLM Providers in KnowFlow AI.
Supports both synchronous completion and token-by-token streaming.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Iterator, Dict, Any, Optional


@dataclass
class LLMResponse:
    """
    Encapsulates the complete synchronous response from an LLM.
    """
    content: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: int = 0
    model_name: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


class BaseLLMProvider(ABC):
    """
    Interface definition for pluggable LLM Providers (Gemini, OpenAI, Mock).
    """

    @abstractmethod
    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
    ) -> LLMResponse:
        """
        Executes a blocking completion call to the LLM.
        """
        pass

    @abstractmethod
    def generate_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
    ) -> Iterator[str]:
        """
        Generates tokens iteratively for Server-Sent Events (SSE) streaming.
        Yields individual string token deltas.
        """
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        """
        Returns the model name identifier in use.
        """
        pass
