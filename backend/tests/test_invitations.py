"""
Automated Tests for Workspace Email Invitations and Token Acceptance Workflow.
"""
import pytest
from datetime import timedelta
from django.utils import timezone
from django.urls import reverse
from rest_framework import status

from apps.workspaces.models import (
    WorkspaceInvitation,
    InvitationStatus,
    WorkspaceMembership,
    WorkspaceRole,
)


@pytest.mark.django_db
class TestWorkspaceInvitations:
    """Test suite for sending, previewing, accepting, and revoking workspace invitations."""

    def test_admin_can_send_invitation(self, admin_client, workspace):
        url = reverse('workspaces:workspace-invitations', kwargs={'workspace_id': workspace.id})
        payload = {
            "email": "new.teammate@company.com",
            "role": WorkspaceRole.MANAGER,
        }
        response = admin_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["success"] is True
        assert response.data["data"]["email"] == "new.teammate@company.com"
        assert response.data["data"]["role"] == WorkspaceRole.MANAGER
        assert response.data["data"]["status"] == InvitationStatus.PENDING
        assert "token" not in response.data["data"]

        # Verify in database
        inv = WorkspaceInvitation.objects.filter(workspace=workspace, email="new.teammate@company.com").first()
        assert inv is not None
        assert inv.status == InvitationStatus.PENDING
        assert inv.role == WorkspaceRole.MANAGER
        assert len(inv.token) > 20

    def test_manager_cannot_send_invitation(self, manager_client, workspace):
        url = reverse('workspaces:workspace-invitations', kwargs={'workspace_id': workspace.id})
        payload = {
            "email": "another@company.com",
            "role": WorkspaceRole.EMPLOYEE,
        }
        response = manager_client.post(url, payload, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_employee_cannot_send_invitation(self, employee_client, workspace):
        url = reverse('workspaces:workspace-invitations', kwargs={'workspace_id': workspace.id})
        payload = {
            "email": "another@company.com",
            "role": WorkspaceRole.EMPLOYEE,
        }
        response = employee_client.post(url, payload, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_cannot_invite_existing_workspace_member(self, admin_client, workspace, workspace_employee):
        url = reverse('workspaces:workspace-invitations', kwargs={'workspace_id': workspace.id})
        payload = {
            "email": workspace_employee.email,
            "role": WorkspaceRole.EMPLOYEE,
        }
        response = admin_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already an active member" in str(response.data)

    def test_public_preview_invitation(self, client, workspace, workspace_admin):
        inv = WorkspaceInvitation.objects.create(
            workspace=workspace,
            email="preview.user@company.com",
            role=WorkspaceRole.EMPLOYEE,
            invited_by=workspace_admin,
            status=InvitationStatus.PENDING
        )
        url = reverse('public-invitation-detail', kwargs={'token': inv.token})
        response = client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True
        assert response.data["data"]["workspace_name"] == workspace.name
        assert response.data["data"]["role"] == WorkspaceRole.EMPLOYEE
        assert response.data["data"]["is_valid"] is True

    def test_accept_invitation_authenticated(self, auth_client, user, workspace, workspace_admin):
        inv = WorkspaceInvitation.objects.create(
            workspace=workspace,
            email=user.email,
            role=WorkspaceRole.MANAGER,
            invited_by=workspace_admin,
            status=InvitationStatus.PENDING
        )
        url = reverse('accept-invitation', kwargs={'token': inv.token})
        response = auth_client.post(url, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True

        # Verify membership was created
        membership = WorkspaceMembership.objects.filter(workspace=workspace, user=user).first()
        assert membership is not None
        assert membership.role == WorkspaceRole.MANAGER

        # Verify invitation status was updated
        inv.refresh_from_db()
        assert inv.status == InvitationStatus.ACCEPTED
        assert inv.accepted_by == user

    def test_expired_invitation_cannot_be_accepted(self, auth_client, user, workspace, workspace_admin):
        inv = WorkspaceInvitation.objects.create(
            workspace=workspace,
            email=user.email,
            role=WorkspaceRole.EMPLOYEE,
            invited_by=workspace_admin,
            status=InvitationStatus.PENDING,
            expires_at=timezone.now() - timedelta(days=1)  # Expired yesterday
        )
        url = reverse('accept-invitation', kwargs={'token': inv.token})
        response = auth_client.post(url, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "cannot be accepted" in response.data["error"]["message"].lower() or "expired" in response.data["error"]["message"].lower()

    def test_admin_can_revoke_invitation(self, admin_client, workspace, workspace_admin):
        inv = WorkspaceInvitation.objects.create(
            workspace=workspace,
            email="to.cancel@company.com",
            role=WorkspaceRole.EMPLOYEE,
            invited_by=workspace_admin,
            status=InvitationStatus.PENDING
        )
        url = reverse('workspaces:workspace-invitation-detail', kwargs={
            'workspace_id': workspace.id,
            'id': inv.id
        })
        response = admin_client.delete(url)

        assert response.status_code == status.HTTP_200_OK
        inv.refresh_from_db()
        assert inv.status == InvitationStatus.CANCELLED

    def test_list_invitations_omits_token_for_owasp_compliance(self, admin_client, workspace, workspace_admin):
        """Ensure GET /workspaces/{id}/invitations/ never exposes raw tokens (OWASP API3)."""
        WorkspaceInvitation.objects.create(
            workspace=workspace,
            email="sensitive.user@company.com",
            role=WorkspaceRole.EMPLOYEE,
            invited_by=workspace_admin,
            status=InvitationStatus.PENDING
        )
        url = reverse('workspaces:workspace-invitations', kwargs={'workspace_id': workspace.id})
        response = admin_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True
        assert len(response.data["data"]) >= 1
        for item in response.data["data"]:
            assert "token" not in item
            assert item["email"] == "sensitive.user@company.com"

    def test_admin_can_resend_invitation(self, admin_client, workspace, workspace_admin):
        """Ensure POST /workspaces/{id}/invitations/{id}/resend/ refreshes expiration date without exposing token."""
        inv = WorkspaceInvitation.objects.create(
            workspace=workspace,
            email="resend.user@company.com",
            role=WorkspaceRole.MANAGER,
            invited_by=workspace_admin,
            status=InvitationStatus.PENDING,
            expires_at=timezone.now() + timedelta(days=1)
        )
        url = reverse('workspaces:workspace-invitation-resend', kwargs={
            'workspace_id': workspace.id,
            'id': inv.id
        })
        response = admin_client.post(url, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True
        assert "token" not in response.data["data"]

        inv.refresh_from_db()
        # Verify expiration extended ~7 days from now
        assert inv.expires_at > timezone.now() + timedelta(days=6)
