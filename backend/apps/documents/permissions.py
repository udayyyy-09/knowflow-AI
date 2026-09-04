"""
Document & Version Permissions for KnowFlow AI.

Enforces Workspace Role-Based Access Control (RBAC):
- ADMIN & MANAGER: Full CRUD (Upload, Versioning, Metadata Edit, Archive/Delete).
- EMPLOYEE: Read-Only (List, View Metadata, Download File).
- Non-Members: 403 Forbidden.
"""
from rest_framework import permissions
from apps.workspaces.models import Workspace, WorkspaceMembership, WorkspaceRole


class CanManageWorkspaceDocuments(permissions.BasePermission):
    """
    Permission check for document modification operations.
    Allows ADMIN and MANAGER roles to upload, edit, version, and delete documents.
    Allows EMPLOYEE read-only access on SAFE_METHODS (GET, HEAD, OPTIONS).
    """
    message = "You do not have permission to manage documents in this workspace. Manager or Admin role required."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        workspace_id = view.kwargs.get('workspace_id')
        if not workspace_id:
            return False

        membership = WorkspaceMembership.objects.filter(
            workspace_id=workspace_id,
            user=request.user,
            workspace__is_active=True
        ).first()

        if not membership:
            return False

        # Read operations allowed for all active members (ADMIN, MANAGER, EMPLOYEE)
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write operations (POST, PUT, PATCH, DELETE) require ADMIN or MANAGER
        return membership.role in [WorkspaceRole.ADMIN, WorkspaceRole.MANAGER]
