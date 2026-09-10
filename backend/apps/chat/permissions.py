"""
RBAC & Ownership Permission Classes for Chat & RAG endpoints.
"""
from rest_framework.permissions import BasePermission
from apps.workspaces.models import WorkspaceMembership, WorkspaceRole


class IsWorkspaceMemberForChat(BasePermission):
    """
    Ensures requesting user has an active membership in the workspace of the conversation.
    """
    message = "You do not have access to this workspace's conversations."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        # obj is Conversation or Workspace
        workspace = getattr(obj, "workspace", obj)
        return WorkspaceMembership.objects.filter(
            workspace=workspace,
            user=request.user,
        ).exists()


class IsConversationOwnerOrAdmin(BasePermission):
    """
    Allows read/write access to the conversation creator, or workspace Admin/Manager.
    """
    message = "You must be the owner of this conversation or a workspace admin to modify it."

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        # Owner always has access
        if obj.user_id == request.user.id:
            return True

        # Admins or managers of the workspace have administrative access
        return WorkspaceMembership.objects.filter(
            workspace=obj.workspace,
            user=request.user,
            role__in=[WorkspaceRole.ADMIN, WorkspaceRole.MANAGER],
        ).exists()
