"""
Role-Based Access Control (RBAC) Permission Classes for Workspaces.

Guarantees strict tenant isolation and enforces permission tiers:
- ADMIN: Full administrative rights over workspace configuration & members.
- MANAGER: Content & document upload / management rights.
- EMPLOYEE: Read / query / conversation access.
"""
from rest_framework import permissions
from typing import Optional
from apps.workspaces.models import Workspace, WorkspaceMembership, WorkspaceRole
from apps.common.cache import CacheService


def get_user_workspace_role(user, workspace_id: Optional[str]) -> Optional[str]:
    """
    Retrieves the user's role in the given workspace, utilizing Redis caching
    to avoid redundant database queries on repeated permission checks.
    """
    if not user or not user.is_authenticated or not workspace_id:
        return None

    user_id_str = str(user.id)
    ws_id_str = str(workspace_id)

    # 1. Check Redis role cache
    cached_role = CacheService.get_user_workspace_role(user_id_str, ws_id_str)
    if cached_role is not None:
        return None if cached_role == "__NONE__" else cached_role

    # 2. Query DB
    membership = WorkspaceMembership.objects.filter(
        workspace_id=ws_id_str,
        user=user,
        workspace__is_active=True,
    ).values_list('role', flat=True).first()

    # 3. Cache result
    role_to_cache = membership if membership is not None else "__NONE__"
    CacheService.set_user_workspace_role(user_id_str, ws_id_str, role_to_cache)
    return membership


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

        role = get_user_workspace_role(request.user, str(workspace_id))
        return role is not None

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True

        workspace = obj if isinstance(obj, Workspace) else getattr(obj, 'workspace', None)
        if not workspace:
            return False

        role = get_user_workspace_role(request.user, str(workspace.id))
        return role is not None


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

        role = get_user_workspace_role(request.user, str(workspace_id))
        return role == WorkspaceRole.ADMIN

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True

        workspace = obj if isinstance(obj, Workspace) else getattr(obj, 'workspace', None)
        if not workspace:
            return False

        role = get_user_workspace_role(request.user, str(workspace.id))
        return role == WorkspaceRole.ADMIN


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

        role = get_user_workspace_role(request.user, str(workspace_id))
        return role in [WorkspaceRole.ADMIN, WorkspaceRole.MANAGER]

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
