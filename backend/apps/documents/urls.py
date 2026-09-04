"""
Document URL Patterns for KnowFlow AI.
"""
from django.urls import path
from apps.documents.views import (
    DocumentListCreateView,
    DocumentDetailView,
    DocumentVersionListView,
    DocumentDownloadView,
)

app_name = 'documents'

urlpatterns = [
    path('', DocumentListCreateView.as_view(), name='document-list-create'),
    path('<uuid:id>/', DocumentDetailView.as_view(), name='document-detail'),
    path('<uuid:document_id>/versions/', DocumentVersionListView.as_view(), name='document-versions'),
    path('<uuid:document_id>/download/', DocumentDownloadView.as_view(), name='document-download'),
]
