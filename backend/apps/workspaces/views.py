"""
Workspace & Membership API Views for KnowFlow AI.
"""
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, PermissionDenied
from django.shortcuts import get_object_or_404

from apps.workspaces.models import Workspace, WorkspaceMembership, WorkspaceRole
from apps.workspaces.permissions import (
    IsWorkspaceMember,
    IsWorkspaceAdmin,
    IsWorkspaceManagerOrAdmin,
)
from apps.workspaces.serializers import (
    WorkspaceSerializer,
    WorkspaceCreateSerializer,
    WorkspaceMembershipSerializer,
    WorkspaceMemberAddSerializer,
    WorkspaceMemberUpdateSerializer,
)


class WorkspaceListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/v1/workspaces/  - List all workspaces the current user belongs to.
    POST /api/v1/workspaces/  - Create a new workspace (creator automatically becomes ADMIN).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return WorkspaceCreateSerializer
        return WorkspaceSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Workspace.objects.filter(is_active=True)
        return Workspace.objects.filter(
            memberships__user=user,
            is_active=True
        ).distinct()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        workspace = serializer.save()
        read_serializer = WorkspaceSerializer(workspace, context={'request': request})
        return Response(
            {
                "success": True,
                "message": "Workspace created successfully.",
                "data": read_serializer.data,
            },
            status=status.HTTP_201_CREATED
        )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = WorkspaceSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = WorkspaceSerializer(queryset, many=True, context={'request': request})
        return Response({
            "success": True,
            "data": serializer.data,
        })


class WorkspaceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/v1/workspaces/<id>/  - Retrieve workspace details (Members only).
    PATCH  /api/v1/workspaces/<id>/  - Update workspace name/description (Admins/Managers).
    DELETE /api/v1/workspaces/<id>/  - Delete/Deactivate workspace (Admins only).
    """
    queryset = Workspace.objects.filter(is_active=True)
    serializer_class = WorkspaceSerializer
    lookup_field = 'id'

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated(), IsWorkspaceMember()]
        elif self.request.method == 'DELETE':
            return [permissions.IsAuthenticated(), IsWorkspaceAdmin()]
        else:  # PATCH/PUT
            return [permissions.IsAuthenticated(), IsWorkspaceAdmin()]

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, context={'request': request})
        return Response({
            "success": True,
            "data": serializer.data,
        })

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial, context={'request': request})
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            "success": True,
            "message": "Workspace updated successfully.",
            "data": serializer.data,
        })

    def perform_destroy(self, instance):
        # Soft-delete by marking inactive, or permanent delete
        instance.is_active = False
        instance.save(update_fields=['is_active'])

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(
            {
                "success": True,
                "message": "Workspace deactivated successfully.",
            },
            status=status.HTTP_200_OK
        )


class WorkspaceMemberListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/v1/workspaces/<workspace_id>/members/ - List all members (Members only).
    POST /api/v1/workspaces/<workspace_id>/members/ - Add/invite user to workspace (Admins only).
    """
    def get_workspace(self):
        workspace_id = self.kwargs.get('workspace_id')
        workspace = get_object_or_404(Workspace, id=workspace_id, is_active=True)
        return workspace

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated(), IsWorkspaceMember()]
        return [permissions.IsAuthenticated(), IsWorkspaceAdmin()]

    def get_queryset(self):
        workspace = self.get_workspace()
        return WorkspaceMembership.objects.filter(workspace=workspace).select_related('user')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return WorkspaceMemberAddSerializer
        return WorkspaceMembershipSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = WorkspaceMembershipSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = WorkspaceMembershipSerializer(queryset, many=True)
        return Response({
            "success": True,
            "data": serializer.data,
        })

    def create(self, request, *args, **kwargs):
        workspace = self.get_workspace()
        serializer = self.get_serializer(
            data=request.data,
            context={'request': request, 'workspace': workspace}
        )
        serializer.is_valid(raise_exception=True)
        membership = serializer.save()
        read_serializer = WorkspaceMembershipSerializer(membership)
        return Response(
            {
                "success": True,
                "message": "Member added to workspace successfully.",
                "data": read_serializer.data,
            },
            status=status.HTTP_201_CREATED
        )


class WorkspaceMemberDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    PATCH  /api/v1/workspaces/<workspace_id>/members/<user_id>/ - Update member role (Admins only).
    DELETE /api/v1/workspaces/<workspace_id>/members/<user_id>/ - Remove member from workspace (Admins only).
    """
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceAdmin]

    def get_object(self):
        workspace_id = self.kwargs.get('workspace_id')
        user_id = self.kwargs.get('user_id')
        membership = get_object_or_404(
            WorkspaceMembership.objects.select_related('user', 'workspace'),
            workspace_id=workspace_id,
            user_id=user_id
        )
        return membership

    def update(self, request, *args, **kwargs):
        membership = self.get_object()
        serializer = WorkspaceMemberUpdateSerializer(membership, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        membership = serializer.save()
        return Response({
            "success": True,
            "message": "Member role updated successfully.",
            "data": WorkspaceMembershipSerializer(membership).data,
        })

    def destroy(self, request, *args, **kwargs):
        membership = self.get_object()
        # Protect last admin from being deleted
        if membership.role == WorkspaceRole.ADMIN:
            admin_count = WorkspaceMembership.objects.filter(
                workspace=membership.workspace,
                role=WorkspaceRole.ADMIN
            ).count()
            if admin_count <= 1:
                return Response(
                    {
                        "success": False,
                        "error": {
                            "code": "CANNOT_REMOVE_LAST_ADMIN",
                            "message": "Cannot remove the only administrator of this workspace.",
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        membership.delete()
        return Response(
            {
                "success": True,
                "message": "Member removed from workspace successfully.",
            },
            status=status.HTTP_200_OK
        )
