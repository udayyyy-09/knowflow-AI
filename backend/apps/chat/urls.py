"""
URL routing for apps.chat (Conversations, Messages, and RAG).
"""
from django.urls import path
from apps.chat.views import (
    WorkspaceConversationListCreateView,
    ConversationDetailView,
    SendMessageView,
)

app_name = "chat"

urlpatterns = [
    path(
        "workspaces/<uuid:workspace_id>/conversations/",
        WorkspaceConversationListCreateView.as_view(),
        name="workspace-conversations",
    ),
    path(
        "conversations/<uuid:conversation_id>/",
        ConversationDetailView.as_view(),
        name="conversation-detail",
    ),
    path(
        "conversations/<uuid:conversation_id>/messages/",
        SendMessageView.as_view(),
        name="conversation-messages",
    ),
]
