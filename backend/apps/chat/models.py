"""
Data models for Chat and RAG conversations, messages, and citation sources.
"""
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _

from apps.common.models import BaseModel
from apps.workspaces.models import Workspace


class Conversation(BaseModel):
    """
    A multi-turn chat conversation within a Workspace.
    Scoped strictly to a specific user and tenant workspace.
    """
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="conversations",
        help_text=_("The workspace this conversation belongs to.")
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversations",
        help_text=_("The user who initiated this conversation.")
    )
    title = models.CharField(
        _("title"),
        max_length=255,
        blank=True,
        default="New Conversation",
        help_text=_("Short descriptive title of the conversation thread.")
    )
    is_active = models.BooleanField(
        _("is active"),
        default=True,
        help_text=_("Soft deletion flag for conversations.")
    )

    class Meta:
        verbose_name = _("conversation")
        verbose_name_plural = _("conversations")
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["workspace", "user", "-updated_at"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.workspace.name})"


class MessageRole(models.TextChoices):
    USER = "user", _("User")
    ASSISTANT = "assistant", _("Assistant")
    SYSTEM = "system", _("System")


class Message(BaseModel):
    """
    A single turn within a Conversation (User query or Assistant response).
    Tracks token counts, latency, and model metadata for LLMOps observability.
    """
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
        help_text=_("The conversation this message belongs to.")
    )
    role = models.CharField(
        _("role"),
        max_length=20,
        choices=MessageRole.choices,
        default=MessageRole.USER,
        help_text=_("The message sender role.")
    )
    content = models.TextField(
        _("content"),
        help_text=_("Raw textual content of the message.")
    )
    prompt_tokens = models.PositiveIntegerField(
        _("prompt tokens"),
        default=0,
        help_text=_("Estimated or actual tokens in prompt.")
    )
    completion_tokens = models.PositiveIntegerField(
        _("completion tokens"),
        default=0,
        help_text=_("Tokens generated in response.")
    )
    total_tokens = models.PositiveIntegerField(
        _("total tokens"),
        default=0,
        help_text=_("Total token consumption for this turn.")
    )
    latency_ms = models.PositiveIntegerField(
        _("latency in ms"),
        default=0,
        help_text=_("End-to-end generation latency in milliseconds.")
    )
    model_name = models.CharField(
        _("model name"),
        max_length=100,
        blank=True,
        help_text=_("The LLM model used (e.g. gemini-1.5-flash, gpt-4o-mini).")
    )
    error_message = models.TextField(
        _("error message"),
        blank=True,
        help_text=_("Recorded error details if generation failed.")
    )

    class Meta:
        verbose_name = _("message")
        verbose_name_plural = _("messages")
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["conversation", "created_at"]),
        ]

    def __str__(self):
        preview = (self.content[:40] + "...") if len(self.content) > 40 else self.content
        return f"[{self.role.upper()}] {preview}"


class MessageSource(BaseModel):
    """
    A structured source citation linking an assistant response to a specific document chunk.
    Enables verifiable, clickable footnotes ([1], [2]) in the client UI.
    """
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="sources",
        help_text=_("The assistant message this citation supports.")
    )
    chunk = models.ForeignKey(
        "documents.DocumentChunk",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cited_in_messages",
        help_text=_("Reference to the specific document chunk cited.")
    )
    citation_index = models.PositiveIntegerField(
        _("citation index"),
        help_text=_("1-based citation index corresponding to [1], [2] in text.")
    )
    similarity_score = models.FloatField(
        _("similarity score"),
        default=0.0,
        help_text=_("Vector search cosine similarity score (0.0 to 1.0).")
    )
    document_title = models.CharField(
        _("document title"),
        max_length=255,
        help_text=_("Denormalized document title for fast frontend rendering.")
    )
    original_filename = models.CharField(
        _("original filename"),
        max_length=255,
        blank=True,
        help_text=_("Denormalized source filename.")
    )
    section_header = models.CharField(
        _("section header"),
        max_length=255,
        blank=True,
        help_text=_("Section header where this chunk was extracted.")
    )
    page_number = models.IntegerField(
        _("page number"),
        null=True,
        blank=True,
        help_text=_("Page number for PDF documents.")
    )
    snippet = models.TextField(
        _("text snippet"),
        blank=True,
        help_text=_("Brief preview snippet of the source chunk for citation popovers.")
    )

    class Meta:
        verbose_name = _("message source")
        verbose_name_plural = _("message sources")
        ordering = ["citation_index"]
        indexes = [
            models.Index(fields=["message", "citation_index"]),
        ]

    def __str__(self):
        return f"[{self.citation_index}] {self.document_title} (Message: {self.message_id})"
