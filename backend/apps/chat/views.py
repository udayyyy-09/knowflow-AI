"""
Views and API Endpoints for Chat Conversations and RAG Message Generation.
Supports both synchronous JSON responses and real-time Server-Sent Events (SSE) streaming.
"""
import logging
from django.shortcuts import get_object_or_404
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import BaseRenderer, JSONRenderer, BrowsableAPIRenderer


class ServerSentEventsRenderer(BaseRenderer):
    """
    Custom DRF renderer to satisfy Accept: text/event-stream content negotiation
    for SSE streaming endpoints.
    """
    media_type = "text/event-stream"
    format = "txt"
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data

from apps.workspaces.models import Workspace, WorkspaceMembership
from apps.chat.models import Conversation, Message
from apps.chat.permissions import IsWorkspaceMemberForChat, IsConversationOwnerOrAdmin
from apps.chat.serializers import (
    ConversationSerializer,
    ConversationDetailSerializer,
    MessageSerializer,
    SendMessageInputSerializer,
)
from apps.chat.services.rag_service import RAGService

logger = logging.getLogger(__name__)


class WorkspaceConversationListCreateView(APIView):
    """
    List conversations in a workspace or create a new conversation thread.
    GET  /api/v1/workspaces/<workspace_id>/conversations/
    POST /api/v1/workspaces/<workspace_id>/conversations/
    """
    permission_classes = [IsAuthenticated, IsWorkspaceMemberForChat]

    def _get_workspace(self, workspace_id, user):
        workspace = get_object_or_404(Workspace, id=workspace_id, is_active=True)
        # Check membership
        if not WorkspaceMembership.objects.filter(workspace=workspace, user=user).exists():
            self.permission_denied(self.request, message="You are not an active member of this workspace.")
        return workspace

    def get(self, request, workspace_id):
        workspace = self._get_workspace(workspace_id, request.user)
        # Return conversations created by this user in this workspace
        conversations = Conversation.objects.filter(
            workspace=workspace,
            user=request.user,
            is_active=True,
        ).order_by("-updated_at")

        serializer = ConversationSerializer(conversations, many=True)
        return Response({
            "success": True,
            "workspace_id": str(workspace.id),
            "count": conversations.count(),
            "results": serializer.data,
        })

    def post(self, request, workspace_id):
        workspace = self._get_workspace(workspace_id, request.user)
        title = request.data.get("title", "").strip() or "New Conversation"

        conversation = Conversation.objects.create(
            workspace=workspace,
            user=request.user,
            title=title,
        )

        serializer = ConversationSerializer(conversation)
        return Response({
            "success": True,
            "message": "Conversation created successfully.",
            "conversation": serializer.data,
        }, status=status.HTTP_201_CREATED)


class ConversationDetailView(APIView):
    """
    Retrieve conversation message history or delete a conversation thread.
    GET    /api/v1/conversations/<conversation_id>/
    DELETE /api/v1/conversations/<conversation_id>/
    """
    permission_classes = [IsAuthenticated, IsConversationOwnerOrAdmin]

    def get_object(self, conversation_id, user):
        conversation = get_object_or_404(Conversation, id=conversation_id, is_active=True)
        self.check_object_permissions(self.request, conversation)
        return conversation

    def get(self, request, conversation_id):
        conversation = self.get_object(conversation_id, request.user)
        serializer = ConversationDetailSerializer(conversation)
        return Response({
            "success": True,
            "conversation": serializer.data,
        })

    def delete(self, request, conversation_id):
        conversation = self.get_object(conversation_id, request.user)
        conversation.is_active = False
        conversation.save(update_fields=["is_active", "updated_at"])
        return Response({
            "success": True,
            "message": "Conversation deleted successfully.",
        }, status=status.HTTP_200_OK)


class SendMessageView(APIView):
    """
    Send a message in a conversation thread and execute RAG.
    Supports both JSON and Server-Sent Events (SSE) streaming.
    POST /api/v1/conversations/<conversation_id>/messages/
    """
    permission_classes = [IsAuthenticated, IsConversationOwnerOrAdmin]
    renderer_classes = [JSONRenderer, ServerSentEventsRenderer, BrowsableAPIRenderer]

    def post(self, request, conversation_id):
        conversation = get_object_or_404(Conversation, id=conversation_id, is_active=True)
        self.check_object_permissions(request, conversation)

        serializer = SendMessageInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid message input.",
                    "details": serializer.errors,
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        content = serializer.validated_data["content"]
        is_stream = serializer.validated_data.get("stream", False) or (
            request.headers.get("Accept") == "text/event-stream"
        )

        rag_service = RAGService()

        # Handle SSE Streaming
        if is_stream:
            stream_gen = rag_service.process_message_stream(
                conversation=conversation,
                user=request.user,
                query_text=content,
            )
            response = StreamingHttpResponse(stream_gen, content_type="text/event-stream")
            response["Cache-Control"] = "no-cache"
            response["X-Accel-Buffering"] = "no"
            return response

        # Handle Standard Synchronous Response
        try:
            assistant_msg, citation_list = rag_service.process_message_sync(
                conversation=conversation,
                user=request.user,
                query_text=content,
            )
        except Exception as e:
            logger.error("RAG processing error: %s", str(e), exc_info=True)
            return Response({
                "success": False,
                "error": {
                    "code": "RAG_PROCESSING_ERROR",
                    "message": str(e),
                }
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        msg_serializer = MessageSerializer(assistant_msg)
        return Response({
            "success": True,
            "conversation_id": str(conversation.id),
            "message": msg_serializer.data,
            "citations_count": len(citation_list),
        }, status=status.HTTP_201_CREATED)
