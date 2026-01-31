"""Abstract base class for inference backends."""

from abc import ABC, abstractmethod
from typing import Any, Dict, Generator, List, Optional


class InferenceBackend(ABC):
    """All inference backends implement this interface."""

    @abstractmethod
    def name(self) -> str:
        """Backend name: 'mlx' or 'llamacpp'."""
        ...

    @abstractmethod
    def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        max_tokens: int = 2048,
        stop: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Non-streaming generation.

        Returns:
            {"text": str, "finish_reason": str,
             "prompt_tokens": int, "completion_tokens": int}
        """
        ...

    @abstractmethod
    def generate_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        max_tokens: int = 2048,
        stop: Optional[List[str]] = None,
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Streaming generation.

        Yields: {"token": str, "done": bool}
        """
        ...
