"""
Deterministic Mock LLM Provider for offline development and testing.
Returns grounded mock answers with citation markers ([1]) without calling external APIs.
"""
import re
from typing import Iterator, Optional
from apps.chat.pipeline.llm.base import BaseLLMProvider, LLMResponse


class MockLLMProvider(BaseLLMProvider):
    """
    Deterministic mock provider for unit tests and local development.
    """

    def __init__(
        self,
        model_name: str = "mock-llm-v1",
        default_response: Optional[str] = None,
        force_error: Optional[Exception] = None,
        **kwargs,
    ):
        self.model_name = model_name
        self.default_response = default_response
        self.force_error = force_error

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
    ) -> LLMResponse:
        if self.force_error:
            raise self.force_error

        if self.default_response:
            content = self.default_response
        else:
            # Check if there are sources in the user prompt
            source_matches = re.findall(r'<source\s+index="(\d+)"', user_prompt)
            if source_matches:
                first_src = source_matches[0]
                content = f"Based on the workspace policy, full-time employees are entitled to standard benefits [{first_src}]."
            else:
                content = "I could not find information about that in the workspace documents."

        return LLMResponse(
            content=content,
            prompt_tokens=len(user_prompt) // 4,
            completion_tokens=len(content) // 4,
            total_tokens=(len(user_prompt) + len(content)) // 4,
            latency_ms=15,
            model_name=self.model_name,
        )

    def generate_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
    ) -> Iterator[str]:
        if self.force_error:
            raise self.force_error

        resp = self.generate(system_prompt, user_prompt, temperature, max_tokens, timeout_seconds)
        words = resp.content.split(" ")
        for i, word in enumerate(words):
            yield word + (" " if i < len(words) - 1 else "")

    def get_model_name(self) -> str:
        return self.model_name
