from django.urls import path, include
from apps.workspaces.views import (
    WorkspaceListCreateView,
    WorkspaceDetailView,
    WorkspaceMemberListCreateView,
    WorkspaceMemberDetailView,
    WorkspaceInvitationListCreateView,
    WorkspaceInvitationDetailView,
    WorkspaceInvitationResendView,
)
from apps.documents.views import VectorSearchView

app_name = 'workspaces'

urlpatterns = [
    path('', WorkspaceListCreateView.as_view(), name='workspace-list-create'),
    path('<uuid:id>/', WorkspaceDetailView.as_view(), name='workspace-detail'),
    path('<uuid:workspace_id>/members/', WorkspaceMemberListCreateView.as_view(), name='workspace-members'),
    path('<uuid:workspace_id>/members/<uuid:user_id>/', WorkspaceMemberDetailView.as_view(), name='workspace-member-detail'),
    path('<uuid:workspace_id>/invitations/', WorkspaceInvitationListCreateView.as_view(), name='workspace-invitations'),
    path('<uuid:workspace_id>/invitations/<uuid:id>/', WorkspaceInvitationDetailView.as_view(), name='workspace-invitation-detail'),
    path('<uuid:workspace_id>/invitations/<uuid:id>/resend/', WorkspaceInvitationResendView.as_view(), name='workspace-invitation-resend'),
    path('<uuid:workspace_id>/search/', VectorSearchView.as_view(), name='workspace-search'),
    path('<uuid:workspace_id>/documents/', include('apps.documents.urls', namespace='documents')),
]


