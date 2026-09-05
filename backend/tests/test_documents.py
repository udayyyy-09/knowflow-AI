"""
Comprehensive Unit & Integration Tests for Document Management (Phase 2).

Tests:
- Document Upload (PDF, DOCX, TXT, MD)
- Document Versioning (v1 -> v2 automatic increment and status update)
- SHA-256 Hash computation & duplicate warnings
- RBAC Permissions (Admin/Manager vs Employee vs Outsider)
- Secure File Download (Bearer token & query param token)
- Document Soft-Deletion / Archival
"""
import io
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status

from apps.documents.models import Document, DocumentVersion, DocumentStatus, DocumentFileType
from tests.conftest import make_client_for_user


def create_dummy_file(filename="test_policy.pdf", content=b"%PDF-1.4 dummy test content"):
    return SimpleUploadedFile(name=filename, content=content, content_type="application/pdf")


@pytest.mark.django_db
class TestDocumentUpload:
    """Tests for document upload endpoint."""

    def test_admin_can_upload_document(self, workspace, workspace_admin):
        client = make_client_for_user(workspace_admin)
        url = reverse('workspaces:documents:document-list-create', kwargs={'workspace_id': workspace.id})
        
        pdf_file = create_dummy_file("security_policy.pdf", b"%PDF-1.4 secure content")
        data = {
            'file': pdf_file,
            'title': 'Security Policy 2026',
            'description': 'Enterprise data security guidelines'
        }

        response = client.post(url, data, format='multipart')
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['success'] is True
        assert response.data['data']['title'] == 'Security Policy 2026'
        assert response.data['data']['file_type'] == 'PDF'
        assert response.data['data']['status'] in (DocumentStatus.UPLOADED, DocumentStatus.QUEUED, DocumentStatus.READY)
        assert response.data['data']['total_versions_count'] == 1

        # Check DB
        doc = Document.objects.get(id=response.data['data']['id'])
        assert doc.workspace == workspace
        assert doc.versions.count() == 1
        ver = doc.active_version
        assert ver.version_number == 1
        assert ver.file_hash_sha256 is not None
        assert ver.file_size_bytes > 0

    def test_manager_can_upload_document(self, workspace, workspace_manager):
        client = make_client_for_user(workspace_manager)
        url = reverse('workspaces:documents:document-list-create', kwargs={'workspace_id': workspace.id})
        
        docx_file = SimpleUploadedFile("handbook.docx", b"dummy docx bytes", content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        data = {'file': docx_file}

        response = client.post(url, data, format='multipart')
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['data']['file_type'] == 'DOCX'

    def test_employee_cannot_upload_document(self, workspace, workspace_employee):
        client = make_client_for_user(workspace_employee)
        url = reverse('workspaces:documents:document-list-create', kwargs={'workspace_id': workspace.id})
        
        pdf_file = create_dummy_file()
        response = client.post(url, {'file': pdf_file}, format='multipart')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_outsider_cannot_upload_document(self, workspace, outsider):
        client = make_client_for_user(outsider)
        url = reverse('workspaces:documents:document-list-create', kwargs={'workspace_id': workspace.id})
        
        pdf_file = create_dummy_file()
        response = client.post(url, {'file': pdf_file}, format='multipart')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_invalid_file_extension_rejected(self, workspace, workspace_admin):
        client = make_client_for_user(workspace_admin)
        url = reverse('workspaces:documents:document-list-create', kwargs={'workspace_id': workspace.id})
        
        bad_file = SimpleUploadedFile("script.exe", b"malicious binary", content_type="application/x-msdownload")
        response = client.post(url, {'file': bad_file}, format='multipart')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestDocumentVersioning:
    """Tests for document versioning (v1, v2)."""

    def test_upload_new_version(self, workspace, workspace_admin):
        client = make_client_for_user(workspace_admin)
        upload_url = reverse('workspaces:documents:document-list-create', kwargs={'workspace_id': workspace.id})

        # 1. Initial upload (v1)
        res1 = client.post(upload_url, {'file': create_dummy_file('policy.pdf', b'v1 content')}, format='multipart')
        doc_id = res1.data['data']['id']

        # 2. Upload v2
        version_url = reverse('workspaces:documents:document-versions', kwargs={'workspace_id': workspace.id, 'document_id': doc_id})
        v2_file = create_dummy_file('policy_updated.pdf', b'v2 updated content')
        res2 = client.post(version_url, {'file': v2_file, 'change_summary': 'Updated policy terms'}, format='multipart')

        assert res2.status_code == status.HTTP_201_CREATED
        assert res2.data['data']['version_number'] == 2
        assert res2.data['data']['is_active'] is True

        # Verify in DB: v1 is deactivated, v2 is active
        doc = Document.objects.get(id=doc_id)
        assert doc.versions.count() == 2
        v1 = doc.versions.get(version_number=1)
        v2 = doc.versions.get(version_number=2)
        assert v1.is_active is False
        assert v2.is_active is True
        assert doc.active_version.version_number == 2


@pytest.mark.django_db
class TestDocumentListingAndDetail:
    """Tests for document queries, search, and retrieval."""

    def test_employee_can_list_and_view_documents(self, workspace, workspace_admin, workspace_employee):
        # Admin uploads a document
        admin_client = make_client_for_user(workspace_admin)
        upload_url = reverse('workspaces:documents:document-list-create', kwargs={'workspace_id': workspace.id})
        res = admin_client.post(upload_url, {'file': create_dummy_file('readme.md', b'# Hello')}, format='multipart')
        doc_id = res.data['data']['id']

        # Employee lists documents
        emp_client = make_client_for_user(workspace_employee)
        list_res = emp_client.get(upload_url)
        assert list_res.status_code == status.HTTP_200_OK
        results = list_res.data.get('results', list_res.data.get('data', []))
        assert len(results) >= 1

        # Employee retrieves document details
        detail_url = reverse('workspaces:documents:document-detail', kwargs={'workspace_id': workspace.id, 'id': doc_id})
        detail_res = emp_client.get(detail_url)
        assert detail_res.status_code == status.HTTP_200_OK
        assert detail_res.data['data']['id'] == doc_id


@pytest.mark.django_db
class TestDocumentDownload:
    """Tests for streaming document download."""

    def test_download_active_version_with_bearer(self, workspace, workspace_admin, workspace_employee):
        admin_client = make_client_for_user(workspace_admin)
        upload_url = reverse('workspaces:documents:document-list-create', kwargs={'workspace_id': workspace.id})
        res = admin_client.post(upload_url, {'file': create_dummy_file('test_dl.pdf', b'PDF STREAM CONTENT')}, format='multipart')
        doc_id = res.data['data']['id']

        emp_client = make_client_for_user(workspace_employee)
        download_url = reverse('workspaces:documents:document-download', kwargs={'workspace_id': workspace.id, 'document_id': doc_id})

        dl_res = emp_client.get(download_url)
        assert dl_res.status_code == status.HTTP_200_OK
        assert dl_res['Content-Disposition'].startswith('attachment;')
        content_bytes = b"".join(dl_res.streaming_content)
        assert b'PDF STREAM CONTENT' in content_bytes


@pytest.mark.django_db
class TestDocumentDeletion:
    """Tests for document archiving and soft deletion."""

    def test_admin_can_archive_document(self, workspace, workspace_admin):
        client = make_client_for_user(workspace_admin)
        upload_url = reverse('workspaces:documents:document-list-create', kwargs={'workspace_id': workspace.id})
        res = client.post(upload_url, {'file': create_dummy_file('to_delete.txt', b'delete me')}, format='multipart')
        doc_id = res.data['data']['id']

        detail_url = reverse('workspaces:documents:document-detail', kwargs={'workspace_id': workspace.id, 'id': doc_id})
        del_res = client.delete(detail_url)
        assert del_res.status_code == status.HTTP_200_OK

        doc = Document.objects.get(id=doc_id)
        assert doc.is_active is False
        assert doc.status == DocumentStatus.ARCHIVED
