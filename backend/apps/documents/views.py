"""
API Views for Document Management in KnowFlow AI.
"""
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
import os

from apps.workspaces.models import Workspace
from apps.documents.models import Document, DocumentVersion, DocumentChunk, DocumentStatus
from apps.documents.permissions import CanManageWorkspaceDocuments
from apps.documents.tasks import process_document_version
from apps.documents.serializers import (
    DocumentListSerializer,
    DocumentDetailSerializer,
    DocumentUploadSerializer,
    DocumentVersionSerializer,
    DocumentVersionCreateSerializer,
    DocumentChunkSerializer,
)


class DocumentListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/v1/workspaces/<workspace_id>/documents/ - List documents in workspace.
    POST /api/v1/workspaces/<workspace_id>/documents/ - Upload a new document.
    """
    permission_classes = [permissions.IsAuthenticated, CanManageWorkspaceDocuments]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return DocumentUploadSerializer
        return DocumentListSerializer

    def get_workspace(self):
        workspace_id = self.kwargs.get('workspace_id')
        return get_object_or_404(Workspace, id=workspace_id, is_active=True)

    def get_queryset(self):
        workspace = self.get_workspace()
        queryset = Document.objects.filter(workspace=workspace, is_active=True).select_related('created_by')

        # Filter by status if provided
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param.upper())

        # Filter by file_type if provided
        file_type_param = self.request.query_params.get('file_type')
        if file_type_param:
            queryset = queryset.filter(file_type=file_type_param.upper())

        # Search by title
        search_query = self.request.query_params.get('search')
        if search_query:
            queryset = queryset.filter(title__icontains=search_query.strip())

        return queryset

    def create(self, request, *args, **kwargs):
        workspace = self.get_workspace()
        serializer = self.get_serializer(
            data=request.data,
            context={'request': request, 'workspace': workspace}
        )
        serializer.is_valid(raise_exception=True)
        document = serializer.save()

        detail_data = DocumentDetailSerializer(document, context={'request': request}).data
        warning_msg = serializer.validated_data.get('duplicate_warning')

        response_payload = {
            "success": True,
            "message": "Document uploaded successfully.",
            "data": detail_data,
        }
        if warning_msg:
            response_payload["warning"] = warning_msg

        return Response(response_payload, status=status.HTTP_201_CREATED)


class DocumentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/v1/workspaces/<workspace_id>/documents/<id>/ - Retrieve document details.
    PATCH  /api/v1/workspaces/<workspace_id>/documents/<id>/ - Update document metadata.
    DELETE /api/v1/workspaces/<workspace_id>/documents/<id>/ - Soft-delete / Archive document.
    """
    permission_classes = [permissions.IsAuthenticated, CanManageWorkspaceDocuments]
    serializer_class = DocumentDetailSerializer
    lookup_field = 'id'

    def get_queryset(self):
        workspace_id = self.kwargs.get('workspace_id')
        return Document.objects.filter(workspace_id=workspace_id, is_active=True)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            "success": True,
            "data": serializer.data,
        })

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Only title and description can be updated via PATCH
        allowed_fields = {'title', 'description'}
        data = {k: v for k, v in request.data.items() if k in allowed_fields}

        for field, value in data.items():
            setattr(instance, field, value)
        instance.save()

        serializer = self.get_serializer(instance)
        return Response({
            "success": True,
            "message": "Document metadata updated successfully.",
            "data": serializer.data,
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.status = DocumentStatus.ARCHIVED
        instance.save(update_fields=['is_active', 'status', 'updated_at'])

        return Response({
            "success": True,
            "message": f"Document '{instance.title}' has been archived and removed from search index."
        }, status=status.HTTP_200_OK)


class DocumentVersionListView(generics.ListCreateAPIView):
    """
    GET  /api/v1/workspaces/<workspace_id>/documents/<document_id>/versions/ - List versions.
    POST /api/v1/workspaces/<workspace_id>/documents/<document_id>/versions/ - Upload new version.
    """
    permission_classes = [permissions.IsAuthenticated, CanManageWorkspaceDocuments]
    parser_classes = [MultiPartParser, FormParser]

    def get_document(self):
        workspace_id = self.kwargs.get('workspace_id')
        document_id = self.kwargs.get('document_id')
        return get_object_or_404(Document, id=document_id, workspace_id=workspace_id, is_active=True)

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return DocumentVersionCreateSerializer
        return DocumentVersionSerializer

    def get_queryset(self):
        document = self.get_document()
        return document.versions.all().order_by('-version_number')

    def create(self, request, *args, **kwargs):
        document = self.get_document()
        serializer = self.get_serializer(
            data=request.data,
            context={'request': request, 'document': document}
        )
        serializer.is_valid(raise_exception=True)
        new_version = serializer.save()

        read_serializer = DocumentVersionSerializer(new_version, context={'request': request})
        return Response({
            "success": True,
            "message": f"New version (v{new_version.version_number}) uploaded successfully.",
            "data": read_serializer.data,
        }, status=status.HTTP_201_CREATED)


from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from apps.workspaces.models import WorkspaceMembership

UserModel = get_user_model()


class DocumentDownloadView(APIView):
    """
    GET /api/v1/workspaces/<workspace_id>/documents/<document_id>/download/
    Securely stream the active document file to authorized users.
    Supports Authorization Bearer header and ?token=<jwt> query parameter for browser direct links.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, workspace_id, document_id):
        user = request.user
        if not user or not user.is_authenticated:
            # Check query param token for browser direct downloads
            token_str = request.query_params.get('token')
            if token_str:
                try:
                    access_token = AccessToken(token_str)
                    user_id = access_token.payload.get('user_id')
                    user = UserModel.objects.filter(id=user_id, is_active=True).first()
                except Exception:
                    user = None

        if not user or not user.is_authenticated:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "AUTHENTICATION_FAILED",
                        "message": "Authentication credentials were not provided. Pass Bearer token or ?token= query parameter.",
                        "details": None
                    }
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Check membership permissions
        if not user.is_superuser:
            has_membership = WorkspaceMembership.objects.filter(
                workspace_id=workspace_id,
                user=user,
                workspace__is_active=True
            ).exists()
            if not has_membership:
                return Response(
                    {
                        "success": False,
                        "error": {
                            "code": "PERMISSION_DENIED",
                            "message": "You are not an authorized member of this workspace.",
                            "details": None
                        }
                    },
                    status=status.HTTP_403_FORBIDDEN
                )

        document = get_object_or_404(
            Document,
            id=document_id,
            workspace_id=workspace_id,
            is_active=True
        )

        active_version = document.active_version
        if not active_version or not active_version.file:
            raise Http404("No active file version exists for this document.")

        file_handle = active_version.file.open('rb')
        response = FileResponse(
            file_handle,
            content_type=active_version.mime_type or 'application/octet-stream'
        )
        response['Content-Disposition'] = f'attachment; filename="{active_version.original_filename}"'
        response['Content-Length'] = active_version.file_size_bytes
        return response


class DocumentChunkListView(generics.ListAPIView):
    """
    GET /api/v1/workspaces/<workspace_id>/documents/<document_id>/chunks/
    Returns all extracted textual chunks with structural metadata.
    Query params:
      - version_id (UUID): Filter chunks for a specific historical version.
      - all (bool): If true, returns chunks across all versions; otherwise defaults to active version.
    """
    permission_classes = [permissions.IsAuthenticated, CanManageWorkspaceDocuments]
    serializer_class = DocumentChunkSerializer

    def get_document(self):
        workspace_id = self.kwargs.get('workspace_id')
        document_id = self.kwargs.get('document_id')
        return get_object_or_404(Document, id=document_id, workspace_id=workspace_id, is_active=True)

    def get_queryset(self):
        document = self.get_document()
        queryset = DocumentChunk.objects.filter(document=document).select_related('version')

        version_id = self.request.query_params.get('version_id')
        show_all = self.request.query_params.get('all', 'false').lower() == 'true'

        if version_id:
            queryset = queryset.filter(version_id=version_id)
        elif not show_all:
            active_version = document.active_version
            if active_version:
                queryset = queryset.filter(version=active_version)
            else:
                queryset = queryset.none()

        return queryset.order_by('chunk_index')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            "success": True,
            "count": len(serializer.data),
            "data": serializer.data
        })


class DocumentReprocessView(APIView):
    """
    POST /api/v1/workspaces/<workspace_id>/documents/<document_id>/reprocess/
    Re-triggers the ingestion and chunking pipeline for the document's active or specified version.
    """
    permission_classes = [permissions.IsAuthenticated, CanManageWorkspaceDocuments]

    def post(self, request, workspace_id, document_id):
        document = get_object_or_404(Document, id=document_id, workspace_id=workspace_id, is_active=True)
        version_id = request.data.get('version_id')

        if version_id:
            target_version = get_object_or_404(DocumentVersion, id=version_id, document=document)
        else:
            target_version = document.active_version

        if not target_version:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "NO_ACTIVE_VERSION",
                        "message": "No file version exists to reprocess.",
                        "details": None
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Mark as queued
        target_version.processing_status = DocumentStatus.QUEUED
        target_version.error_message = ""
        target_version.save(update_fields=['processing_status', 'error_message', 'updated_at'])

        document.status = DocumentStatus.QUEUED
        document.save(update_fields=['status', 'updated_at'])

        # Dispatch async task
        process_document_version.delay(str(target_version.id))

        return Response({
            "success": True,
            "message": f"Ingestion task queued for '{document.title}' (v{target_version.version_number}).",
            "data": {
                "document_id": str(document.id),
                "version_id": str(target_version.id),
                "version_number": target_version.version_number,
                "status": DocumentStatus.QUEUED
            }
        }, status=status.HTTP_202_ACCEPTED)
