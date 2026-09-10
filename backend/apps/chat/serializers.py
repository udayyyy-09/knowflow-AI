"""
Serializers for Chat and RAG conversations, messages, and citation sources.
"""
from rest_framework import serializers
from apps.chat.models import Conversation, Message, MessageSource


class MessageSourceSerializer(serializers.ModelSerializer):
    """Serializer for structured citation sources."""

    class Meta:
        model = MessageSource
        fields = [
            "id",
            "citation_index",
            "chunk_id",
            "similarity_score",
            "document_title",
            "original_filename",
            "section_header",
            "page_number",
            "snippet",
        ]


class MessageSerializer(serializers.ModelSerializer):
    """Serializer for conversation messages with nested citation sources."""

    sources = MessageSourceSerializer(many=True, read_only=True)

    class Meta:
        model = Message
        fields = [
            "id",
            "role",
            "content",
            "prompt_tokens",
            "completion_tokens",
            "total_tokens",
            "latency_ms",
            "model_name",
            "sources",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "role",
            "prompt_tokens",
            "completion_tokens",
            "total_tokens",
            "latency_ms",
            "model_name",
            "sources",
            "created_at",
        ]


class ConversationSerializer(serializers.ModelSerializer):
    """Serializer for listing and creating conversation threads."""

    message_count = serializers.IntegerField(source="messages.count", read_only=True)

    class Meta:
        model = Conversation
        fields = [
            "id",
            "workspace_id",
            "user_id",
            "title",
            "is_active",
            "message_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "workspace_id", "user_id", "created_at", "updated_at"]


class ConversationDetailSerializer(serializers.ModelSerializer):
    """Serializer for retrieving full conversation thread with message history."""

    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = [
            "id",
            "workspace_id",
            "user_id",
            "title",
            "is_active",
            "messages",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "workspace_id", "user_id", "created_at", "updated_at"]


class SendMessageInputSerializer(serializers.Serializer):
    """Validation serializer for sending a user question in a conversation."""

    content = serializers.CharField(
        required=True,
        max_length=4000,
        help_text="User prompt or question to ask against the workspace documents."
    )
    stream = serializers.BooleanField(
        required=False,
        default=False,
        help_text="If True, returns a Server-Sent Events (SSE) stream of token deltas."
    )

    def validate_content(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Message content cannot be empty or whitespace.")
        return cleaned
