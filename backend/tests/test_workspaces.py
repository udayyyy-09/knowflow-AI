"""
Automated Tests for Workspace CRUD and Member Management.
"""
import pytest
from django.urls import reverse
from rest_framework import status

from apps.workspaces.models import Workspace, WorkspaceMembership, WorkspaceRole


@pytest.mark.django_db
class TestWorkspaceCRUD:
    """Test suite for Workspace creation, listing, retrieval, update, and deletion."""

    def test_create_workspace_success(self, auth_client, user):
        url = reverse('workspaces:workspace-list-create')
        payload = {
            "name": "Product Design Team",
            "description": "Design system guidelines and UX flows"
        }
        response = auth_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["success"] is True
        assert response.data["data"]["name"] == "Product Design Team"
        assert response.data["data"]["slug"] == "product-design-team"
        assert response.data["data"]["current_user_role"] == WorkspaceRole.ADMIN

        # Verify membership automatically created
        workspace_id = response.data["data"]["id"]
        membership = WorkspaceMembership.objects.filter(workspace_id=workspace_id, user=user).first()
        assert membership is not None
        assert membership.role == WorkspaceRole.ADMIN

    def test_workspace_tenant_isolation(self, auth_client, user, outsider_client, outsider):
        # Create workspace for user
        ws_url = reverse('workspaces:workspace-list-create')
        auth_client.post(ws_url, {"name": "Alice Private Workspace"}, format='json')

        # Outsider lists workspaces -> should NOT see Alice's workspace
        response = outsider_client.get(ws_url)
        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data.get("data", []))
        names = [w["name"] for w in results]
        assert "Alice Private Workspace" not in names

    def test_retrieve_workspace_details(self, admin_client, workspace):
        url = reverse('workspaces:workspace-detail', kwargs={'id': workspace.id})
        response = admin_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"]["name"] == workspace.name
        assert response.data["data"]["member_count"] == 3

    def test_update_workspace(self, admin_client, workspace):
        url = reverse('workspaces:workspace-detail', kwargs={'id': workspace.id})
        response = admin_client.patch(url, {"description": "Updated description"}, format='json')

        assert response.status_code == status.HTTP_200_OK
        workspace.refresh_from_db()
        assert workspace.description == "Updated description"

    def test_delete_workspace(self, admin_client, workspace):
        url = reverse('workspaces:workspace-detail', kwargs={'id': workspace.id})
        response = admin_client.delete(url)

        assert response.status_code == status.HTTP_200_OK
        workspace.refresh_from_db()
        assert workspace.is_active is False


@pytest.mark.django_db
class TestWorkspaceMembers:
    """Test suite for managing workspace members."""

    def test_list_workspace_members(self, employee_client, workspace):
        url = reverse('workspaces:workspace-members', kwargs={'workspace_id': workspace.id})
        response = employee_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.data.get("results", response.data.get("data", []))
        assert len(data) == 3

    def test_admin_can_add_member(self, admin_client, workspace, user_factory):
        new_colleague = user_factory(email="colleague@knowflow.ai")
        url = reverse('workspaces:workspace-members', kwargs={'workspace_id': workspace.id})
        payload = {
            "email": "colleague@knowflow.ai",
            "role": WorkspaceRole.MANAGER
        }
        response = admin_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["data"]["user"]["email"] == "colleague@knowflow.ai"
        assert response.data["data"]["role"] == WorkspaceRole.MANAGER

    def test_add_nonexistent_user_fails(self, admin_client, workspace):
        url = reverse('workspaces:workspace-members', kwargs={'workspace_id': workspace.id})
        payload = {
            "email": "doesnotexist@knowflow.ai",
            "role": WorkspaceRole.EMPLOYEE
        }
        response = admin_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["success"] is False

    def test_admin_can_update_member_role(self, admin_client, workspace, workspace_employee):
        url = reverse('workspaces:workspace-member-detail', kwargs={
            'workspace_id': workspace.id,
            'user_id': workspace_employee.id
        })
        response = admin_client.patch(url, {"role": WorkspaceRole.MANAGER}, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"]["role"] == WorkspaceRole.MANAGER

    def test_cannot_demote_only_admin(self, admin_client, workspace, workspace_admin):
        url = reverse('workspaces:workspace-member-detail', kwargs={
            'workspace_id': workspace.id,
            'user_id': workspace_admin.id
        })
        response = admin_client.patch(url, {"role": WorkspaceRole.EMPLOYEE}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["success"] is False

    def test_admin_can_remove_member(self, admin_client, workspace, workspace_employee):
        url = reverse('workspaces:workspace-member-detail', kwargs={
            'workspace_id': workspace.id,
            'user_id': workspace_employee.id
        })
        response = admin_client.delete(url)

        assert response.status_code == status.HTTP_200_OK
        assert not WorkspaceMembership.objects.filter(workspace=workspace, user=workspace_employee).exists()
