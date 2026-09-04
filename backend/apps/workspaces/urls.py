"""
Workspace URL Patterns for KnowFlow AI.
"""
from django.urls import path, include
from apps.workspaces.views import (
    WorkspaceListCreateView,
    WorkspaceDetailView,
    WorkspaceMemberListCreateView,
    WorkspaceMemberDetailView,
)

app_name = 'workspaces'

urlpatterns = [
    path('', WorkspaceListCreateView.as_view(), name='workspace-list-create'),
    path('<uuid:id>/', WorkspaceDetailView.as_view(), name='workspace-detail'),
    path('<uuid:workspace_id>/members/', WorkspaceMemberListCreateView.as_view(), name='workspace-members'),
    path('<uuid:workspace_id>/members/<uuid:user_id>/', WorkspaceMemberDetailView.as_view(), name='workspace-member-detail'),
    path('<uuid:workspace_id>/documents/', include('apps.documents.urls', namespace='documents')),
]
