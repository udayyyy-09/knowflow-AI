"""
Automated Tests for Role-Based Access Control (RBAC) Enforcement in Workspaces.
"""
import pytest
from django.urls import reverse
from rest_framework import status

from apps.workspaces.models import WorkspaceRole


@pytest.mark.django_db
class TestRBACPermissions:
    """Test suite ensuring strict permission checks between ADMIN, MANAGER, EMPLOYEE, and NON-MEMBERS."""

    def test_outsider_cannot_access_workspace(self, outsider_client, workspace):
        url = reverse('workspaces:workspace-detail', kwargs={'id': workspace.id})
        response = outsider_client.get(url)
        assert response.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND]

    def test_outsider_cannot_view_members(self, outsider_client, workspace):
        url = reverse('workspaces:workspace-members', kwargs={'workspace_id': workspace.id})
        response = outsider_client.get(url)
        assert response.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND]

    def test_employee_cannot_update_workspace(self, employee_client, workspace):
        url = reverse('workspaces:workspace-detail', kwargs={'id': workspace.id})
        response = employee_client.patch(url, {"name": "Hacked Name"}, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_manager_cannot_delete_workspace(self, manager_client, workspace):
        url = reverse('workspaces:workspace-detail', kwargs={'id': workspace.id})
        response = manager_client.delete(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_employee_cannot_delete_workspace(self, employee_client, workspace):
        url = reverse('workspaces:workspace-detail', kwargs={'id': workspace.id})
        response = employee_client.delete(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_employee_cannot_add_members(self, employee_client, workspace, user_factory):
        user_factory(email="newemployee@knowflow.ai")
        url = reverse('workspaces:workspace-members', kwargs={'workspace_id': workspace.id})
        payload = {"email": "newemployee@knowflow.ai", "role": WorkspaceRole.EMPLOYEE}
        response = employee_client.post(url, payload, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_manager_cannot_add_members(self, manager_client, workspace, user_factory):
        user_factory(email="newmanager@knowflow.ai")
        url = reverse('workspaces:workspace-members', kwargs={'workspace_id': workspace.id})
        payload = {"email": "newmanager@knowflow.ai", "role": WorkspaceRole.EMPLOYEE}
        response = manager_client.post(url, payload, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_employee_cannot_modify_member_role(self, employee_client, workspace, workspace_manager):
        url = reverse('workspaces:workspace-member-detail', kwargs={
            'workspace_id': workspace.id,
            'user_id': workspace_manager.id
        })
        response = employee_client.patch(url, {"role": WorkspaceRole.ADMIN}, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_employee_cannot_remove_member(self, employee_client, workspace, workspace_manager):
        url = reverse('workspaces:workspace-member-detail', kwargs={
            'workspace_id': workspace.id,
            'user_id': workspace_manager.id
        })
        response = employee_client.delete(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN
