"""
Role-Based Access Control (RBAC) Permission Classes for Workspaces.

Guarantees strict tenant isolation and enforces permission tiers:
- ADMIN: Full administrative rights over workspace configuration & members.
- MANAGER: Content & document upload / management rights.
- EMPLOYEE: Read / query / conversation access.
"""
from rest_framework import permissions
from apps.workspaces.models import Workspace, WorkspaceMembership, WorkspaceRole


class IsWorkspaceMember(permissions.BasePermission):
    """
    Ensures the user has an active membership in the target workspace.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True

        workspace_id = view.kwargs.get('workspace_id') or view.kwargs.get('pk')
        if not workspace_id:
            return True  # For list views, filtering is handled by queryset

        return WorkspaceMembership.objects.filter(
            workspace_id=workspace_id,
            user=request.user,
            workspace__is_active=True
        ).exists()

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True

        workspace = obj if isinstance(obj, Workspace) else getattr(obj, 'workspace', None)
        if not workspace:
            return False

        return WorkspaceMembership.objects.filter(
            workspace=workspace,
            user=request.user,
            workspace__is_active=True
        ).exists()


class IsWorkspaceAdmin(permissions.BasePermission):
    """
    Ensures the user holds the ADMIN role in the target workspace.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True

        workspace_id = view.kwargs.get('workspace_id') or view.kwargs.get('pk')
        if not workspace_id:
            return True

        return WorkspaceMembership.objects.filter(
            workspace_id=workspace_id,
            user=request.user,
            role=WorkspaceRole.ADMIN,
            workspace__is_active=True
        ).exists()

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True

        workspace = obj if isinstance(obj, Workspace) else getattr(obj, 'workspace', None)
        if not workspace:
            return False

        return WorkspaceMembership.objects.filter(
            workspace=workspace,
            user=request.user,
            role=WorkspaceRole.ADMIN,
            workspace__is_active=True
        ).exists()


class IsWorkspaceManagerOrAdmin(permissions.BasePermission):
    """
    Ensures the user holds either the MANAGER or ADMIN role in the target workspace.
    Used for document upload, processing trigger, and management operations.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True

        workspace_id = view.kwargs.get('workspace_id') or view.kwargs.get('pk')
        if not workspace_id:
            return True

        return WorkspaceMembership.objects.filter(
            workspace_id=workspace_id,
            user=request.user,
            role__in=[WorkspaceRole.ADMIN, WorkspaceRole.MANAGER],
            workspace__is_active=True
        ).exists()

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True

        workspace = obj if isinstance(obj, Workspace) else getattr(obj, 'workspace', None)
        if not workspace:
            return False

        return WorkspaceMembership.objects.filter(
            workspace=workspace,
            user=request.user,
            role__in=[WorkspaceRole.ADMIN, WorkspaceRole.MANAGER],
            workspace__is_active=True
        ).exists()
