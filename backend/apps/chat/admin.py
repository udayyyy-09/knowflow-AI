"""
Django Admin registration for Chat & RAG models.
"""
from django.contrib import admin
from apps.chat.models import Conversation, Message, MessageSource


class MessageSourceInline(admin.TabularInline):
    model = MessageSource
    extra = 0
    readonly_fields = [
        "citation_index",
        "document_title",
        "section_header",
        "page_number",
        "similarity_score",
        "snippet",
        "created_at",
    ]
    can_delete = False


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    fields = ["role", "content_preview", "prompt_tokens", "completion_tokens", "latency_ms", "created_at"]
    readonly_fields = ["role", "content_preview", "prompt_tokens", "completion_tokens", "latency_ms", "created_at"]
    can_delete = False

    def content_preview(self, obj):
        return (obj.content[:60] + "...") if len(obj.content) > 60 else obj.content
    content_preview.short_description = "Content"


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ["id", "title", "workspace", "user", "is_active", "created_at", "updated_at"]
    list_filter = ["workspace", "is_active", "created_at"]
    search_fields = ["title", "user__email", "workspace__name"]
    readonly_fields = ["id", "created_at", "updated_at"]
    inlines = [MessageInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ["id", "conversation", "role", "model_name", "prompt_tokens", "completion_tokens", "latency_ms", "created_at"]
    list_filter = ["role", "model_name", "created_at"]
    search_fields = ["content", "conversation__title"]
    readonly_fields = ["id", "created_at", "updated_at"]
    inlines = [MessageSourceInline]


@admin.register(MessageSource)
class MessageSourceAdmin(admin.ModelAdmin):
    list_display = ["id", "message", "citation_index", "document_title", "section_header", "similarity_score", "created_at"]
    list_filter = ["similarity_score", "created_at"]
    search_fields = ["document_title", "section_header", "snippet"]
    readonly_fields = ["id", "created_at", "updated_at"]
