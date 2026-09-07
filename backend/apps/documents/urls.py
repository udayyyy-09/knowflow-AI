from django.urls import path
from apps.documents.views import (
    DocumentListCreateView,
    DocumentDetailView,
    DocumentVersionListView,
    DocumentDownloadView,
    DocumentChunkListView,
    DocumentReprocessView,
    DocumentReembedView,
    VectorSearchView,
)

app_name = 'documents'

urlpatterns = [
    path('', DocumentListCreateView.as_view(), name='document-list-create'),
    path('search/', VectorSearchView.as_view(), name='document-search'),
    path('<uuid:id>/', DocumentDetailView.as_view(), name='document-detail'),
    path('<uuid:document_id>/versions/', DocumentVersionListView.as_view(), name='document-versions'),
    path('<uuid:document_id>/download/', DocumentDownloadView.as_view(), name='document-download'),
    path('<uuid:document_id>/chunks/', DocumentChunkListView.as_view(), name='document-chunks'),
    path('<uuid:document_id>/reprocess/', DocumentReprocessView.as_view(), name='document-reprocess'),
    path('<uuid:document_id>/reembed/', DocumentReembedView.as_view(), name='document-reembed'),
]

