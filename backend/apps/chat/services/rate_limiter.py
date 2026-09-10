"""
Rate Limiting & Cost Guardrail Service.
Provides Redis-backed token bucket rate limiting per user and per workspace,
and enforces conversation length limits to prevent cost exhaustion.
"""
import time
import logging
from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import Throttled

from apps.chat.models import Conversation, Message

logger = logging.getLogger(__name__)


class ChatRateLimiter:
    """
    Enforces per-user and per-workspace request rate limits, and caps conversation length.
    """

    KEY_PREFIX_USER = "knowflow:ratelimit:user:"
    KEY_PREFIX_WORKSPACE = "knowflow:ratelimit:ws:"
    WINDOW_SECONDS = 60

    @classmethod
    def check_rate_limits(cls, user_id: str, workspace_id: str):
        """
        Validates that user and workspace are within allowed RPM limits.
        Raises Throttled if limits exceeded.
        """
        user_limit = getattr(settings, "RAG_USER_RATE_LIMIT", 10)
        ws_limit = getattr(settings, "RAG_WORKSPACE_RATE_LIMIT", 60)

        current_time = int(time.time())
        window = current_time // cls.WINDOW_SECONDS

        # 1. User rate limit check
        user_key = f"{cls.KEY_PREFIX_USER}{user_id}:{window}"
        try:
            user_count = cache.incr(user_key)
        except ValueError:
            cache.set(user_key, 1, cls.WINDOW_SECONDS + 10)
            user_count = 1

        if user_count > user_limit:
            logger.warning("User %s exceeded RAG rate limit (%d/%d rpm)", user_id, user_count, user_limit)
            raise Throttled(
                detail=f"User rate limit exceeded ({user_limit} requests/minute). Please wait a moment."
            )

        # 2. Workspace rate limit check
        ws_key = f"{cls.KEY_PREFIX_WORKSPACE}{workspace_id}:{window}"
        try:
            ws_count = cache.incr(ws_key)
        except ValueError:
            cache.set(ws_key, 1, cls.WINDOW_SECONDS + 10)
            ws_count = 1

        if ws_count > ws_limit:
            logger.warning("Workspace %s exceeded RAG rate limit (%d/%d rpm)", workspace_id, ws_count, ws_limit)
            raise Throttled(
                detail=f"Workspace rate limit exceeded ({ws_limit} requests/minute). Please wait a moment."
            )

    @classmethod
    def check_conversation_capacity(cls, conversation: Conversation):
        """
        Validates that conversation has not exceeded maximum message threshold.
        """
        max_messages = getattr(settings, "RAG_MAX_MESSAGES_PER_CONVERSATION", 50)
        message_count = conversation.messages.count()
        if message_count >= max_messages:
            logger.warning(
                "Conversation %s reached max message limit (%d/%d)",
                conversation.id,
                message_count,
                max_messages,
            )
            raise Throttled(
                detail=f"This conversation has reached the limit of {max_messages} messages. Please start a new conversation."
            )
