"""
Pytest configuration and shared fixtures for KnowFlow AI test suite.
"""
import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User, AuthProvider
from apps.workspaces.models import Workspace, WorkspaceMembership, WorkspaceRole


@pytest.fixture
def api_client():
    """Unauthenticated DRF API client."""
    return APIClient()


@pytest.fixture
def user_factory(db):
    """Factory fixture to create users with custom attributes."""
    def create_user(email="testuser@knowflow.ai", password="StrongPassword123!", **kwargs):
        return User.objects.create_user(
            email=email,
            password=password,
            first_name=kwargs.get('first_name', 'Test'),
            last_name=kwargs.get('last_name', 'User'),
            **{k: v for k, v in kwargs.items() if k not in ['first_name', 'last_name']}
        )
    return create_user


@pytest.fixture
def user(user_factory):
    """Standard authenticated user."""
    return user_factory(email="alice@knowflow.ai", first_name="Alice", last_name="Smith")


@pytest.fixture
def auth_client(api_client, user):
    """Authenticated API client for standard user."""
    refresh = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
    api_client.user = user
    return api_client


@pytest.fixture
def workspace_admin(user_factory):
    return user_factory(email="admin@knowflow.ai", first_name="Admin", last_name="User")


@pytest.fixture
def workspace_manager(user_factory):
    return user_factory(email="manager@knowflow.ai", first_name="Manager", last_name="User")


@pytest.fixture
def workspace_employee(user_factory):
    return user_factory(email="employee@knowflow.ai", first_name="Employee", last_name="User")


@pytest.fixture
def outsider(user_factory):
    return user_factory(email="outsider@knowflow.ai", first_name="Outsider", last_name="User")


@pytest.fixture
def workspace(db, workspace_admin, workspace_manager, workspace_employee):
    """
    Workspace fixture populated with an Admin, a Manager, and an Employee.
    """
    ws = Workspace.objects.create(
        name="Engineering Workspace",
        description="Internal engineering policies and architecture docs",
        created_by=workspace_admin
    )
    # Admin membership
    WorkspaceMembership.objects.create(
        workspace=ws,
        user=workspace_admin,
        role=WorkspaceRole.ADMIN
    )
    # Manager membership
    WorkspaceMembership.objects.create(
        workspace=ws,
        user=workspace_manager,
        role=WorkspaceRole.MANAGER
    )
    # Employee membership
    WorkspaceMembership.objects.create(
        workspace=ws,
        user=workspace_employee,
        role=WorkspaceRole.EMPLOYEE
    )
    return ws


def make_client_for_user(user_obj):
    client = APIClient()
    refresh = RefreshToken.for_user(user_obj)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
    client.user = user_obj
    return client


@pytest.fixture
def admin_client(workspace_admin):
    return make_client_for_user(workspace_admin)


@pytest.fixture
def manager_client(workspace_manager):
    return make_client_for_user(workspace_manager)


@pytest.fixture
def employee_client(workspace_employee):
    return make_client_for_user(workspace_employee)


@pytest.fixture
def outsider_client(outsider):
    return make_client_for_user(outsider)
