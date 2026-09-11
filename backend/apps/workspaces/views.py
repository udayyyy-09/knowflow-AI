"""
Workspace & Membership API Views for KnowFlow AI.
"""
import logging
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, PermissionDenied
from django.shortcuts import get_object_or_404

logger = logging.getLogger(__name__)

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
from apps.common.cache import CacheService


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
        CacheService.invalidate_workspace_detail(str(instance.id))
        return Response({
            "success": True,
            "message": "Workspace updated successfully.",
            "data": serializer.data,
        })

    def perform_destroy(self, instance):
        # Soft-delete by marking inactive, or permanent delete
        instance.is_active = False
        instance.save(update_fields=['is_active'])
        CacheService.invalidate_workspace_detail(str(instance.id))
        CacheService.bump_knowledge_version(str(instance.id))

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
        return (
            WorkspaceMembership.objects.filter(workspace=workspace, workspace__is_active=True)
            .select_related('user')
            .order_by('role', 'created_at')
        )

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
        CacheService.invalidate_user_workspace_role(str(membership.user_id), str(workspace.id))
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
        CacheService.invalidate_user_workspace_role(str(membership.user_id), str(membership.workspace_id))
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

        user_id_str = str(membership.user_id)
        ws_id_str = str(membership.workspace_id)
        membership.delete()
        CacheService.invalidate_user_workspace_role(user_id_str, ws_id_str)
        return Response(
            {
                "success": True,
                "message": "Member removed from workspace successfully.",
            },
            status=status.HTTP_200_OK
        )


from apps.workspaces.models import WorkspaceInvitation, InvitationStatus
from apps.workspaces.serializers import (
    WorkspaceInvitationSerializer,
    WorkspaceInvitationCreateSerializer,
    WorkspaceInvitationPublicSerializer,
)
from apps.workspaces.tasks import send_workspace_invitation_email
from django.utils import timezone
from django.db import transaction


class WorkspaceInvitationListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/v1/workspaces/<workspace_id>/invitations/ - List pending invitations (Admins only).
    POST /api/v1/workspaces/<workspace_id>/invitations/ - Send email invitation (Admins only).
    """
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceAdmin]

    def get_workspace(self):
        workspace_id = self.kwargs.get('workspace_id')
        workspace = get_object_or_404(Workspace, id=workspace_id, is_active=True)
        return workspace

    def get_queryset(self):
        workspace = self.get_workspace()
        return WorkspaceInvitation.objects.filter(
            workspace=workspace,
            status=InvitationStatus.PENDING
        ).select_related('invited_by')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return WorkspaceInvitationCreateSerializer
        return WorkspaceInvitationSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = WorkspaceInvitationSerializer(queryset, many=True)
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
        
        email = serializer.validated_data['email']
        role = serializer.validated_data['role']

        with transaction.atomic():
            # Invalidate any older pending invitations for the same email in this workspace
            WorkspaceInvitation.objects.filter(
                workspace=workspace,
                email=email,
                status=InvitationStatus.PENDING
            ).update(status=InvitationStatus.CANCELLED)

            invitation = WorkspaceInvitation.objects.create(
                workspace=workspace,
                email=email,
                role=role,
                invited_by=request.user,
                status=InvitationStatus.PENDING
            )

        # Dispatch asynchronous Celery task to send invitation email
        try:
            send_workspace_invitation_email.delay(str(invitation.id))
        except Exception as e:
            logger.warning("Could not dispatch async invitation email celery task: %s", e)

        read_serializer = WorkspaceInvitationSerializer(invitation)
        return Response(
            {
                "success": True,
                "message": f"Invitation sent successfully to {email}.",
                "data": read_serializer.data,
            },
            status=status.HTTP_201_CREATED
        )


class WorkspaceInvitationDetailView(generics.DestroyAPIView):
    """
    DELETE /api/v1/workspaces/<workspace_id>/invitations/<id>/ - Revoke/Cancel pending invitation.
    """
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceAdmin]

    def get_object(self):
        workspace_id = self.kwargs.get('workspace_id')
        invitation_id = self.kwargs.get('id') or self.kwargs.get('pk')
        return get_object_or_404(
            WorkspaceInvitation,
            id=invitation_id,
            workspace_id=workspace_id,
            status=InvitationStatus.PENDING
        )

    def destroy(self, request, *args, **kwargs):
        invitation = self.get_object()
        invitation.status = InvitationStatus.CANCELLED
        invitation.save(update_fields=['status', 'updated_at'])
        return Response({
            "success": True,
            "message": f"Invitation for '{invitation.email}' has been revoked."
        }, status=status.HTTP_200_OK)


class PublicInvitationDetailView(generics.GenericAPIView):
    """
    GET /api/v1/invitations/<token>/ - Retrieve public invitation preview details.
    Allows unauthenticated visitors to inspect the invitation details.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        invitation = WorkspaceInvitation.objects.select_related('workspace', 'invited_by').filter(token=token).first()
        if not invitation:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "INVITATION_NOT_FOUND",
                        "message": "This invitation link does not exist or has been removed."
                    }
                },
                status=status.HTTP_404_NOT_FOUND
            )

        if not invitation.is_valid:
            status_message = "This invitation has expired." if invitation.status == InvitationStatus.EXPIRED or timezone.now() >= invitation.expires_at else f"This invitation is no longer active ({invitation.status.lower()})."
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "INVITATION_INVALID",
                        "message": status_message,
                        "status": invitation.status
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        inviter_name = invitation.invited_by.get_full_name() or invitation.invited_by.email
        data = {
            "token": invitation.token,
            "workspace_name": invitation.workspace.name,
            "workspace_description": invitation.workspace.description or "",
            "inviter_name": inviter_name,
            "inviter_email": invitation.invited_by.email,
            "role": invitation.role,
            "email": invitation.email,
            "expires_at": invitation.expires_at,
            "is_valid": True,
        }
        serializer = WorkspaceInvitationPublicSerializer(data)
        return Response({
            "success": True,
            "data": serializer.data
        })


class AcceptInvitationView(generics.GenericAPIView):
    """
    POST /api/v1/invitations/<token>/accept/ - Authenticated user accepts invitation and joins workspace.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, token):
        invitation = get_object_or_404(
            WorkspaceInvitation.objects.select_related('workspace'),
            token=token
        )

        if not invitation.is_valid:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "INVITATION_INVALID",
                        "message": f"This invitation cannot be accepted ({invitation.status.lower()})."
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        workspace = invitation.workspace

        with transaction.atomic():
            membership, created = WorkspaceMembership.objects.get_or_create(
                workspace=workspace,
                user=user,
                defaults={'role': invitation.role}
            )
            if not created:
                # If already member, update role to highest role if assigned higher
                if invitation.role == WorkspaceRole.ADMIN:
                    membership.role = WorkspaceRole.ADMIN
                    membership.save(update_fields=['role', 'updated_at'])

            invitation.status = InvitationStatus.ACCEPTED
            invitation.accepted_at = timezone.now()
            invitation.accepted_by = user
            invitation.save(update_fields=['status', 'accepted_at', 'accepted_by', 'updated_at'])

        CacheService.invalidate_user_workspace_role(str(user.id), str(workspace.id))

        read_serializer = WorkspaceSerializer(workspace, context={'request': request})
        return Response(
            {
                "success": True,
                "message": f"Successfully joined '{workspace.name}' as {invitation.role}.",
                "data": {
                    "workspace": read_serializer.data,
                    "role": invitation.role
                }
            },
            status=status.HTTP_200_OK
        )

