"""
Document and DocumentVersion Models for KnowFlow AI.

Implements multi-tenant document storage, versioning, SHA-256 deduplication,
and lifecycle tracking within Workspaces.
"""
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _
import os

from apps.common.models import BaseModel
from apps.workspaces.models import Workspace
from apps.documents.services.storage import document_upload_path


class DocumentStatus(models.TextChoices):
    """
    Lifecycle processing states for documents and document versions.
    """
    UPLOADED = 'UPLOADED', _('Uploaded')
    QUEUED = 'QUEUED', _('Queued for Processing')
    PROCESSING = 'PROCESSING', _('Extracting Content & Chunking')
    EMBEDDING = 'EMBEDDING', _('Generating Vector Embeddings')
    READY = 'READY', _('Ready for RAG Search')
    FAILED = 'FAILED', _('Processing Failed')
    ARCHIVED = 'ARCHIVED', _('Archived')


class DocumentFileType(models.TextChoices):
    """
    Supported document file formats.
    """
    PDF = 'PDF', _('Portable Document Format (.pdf)')
    DOCX = 'DOCX', _('Microsoft Word (.docx)')
    TXT = 'TXT', _('Plain Text (.txt)')
    MD = 'MD', _('Markdown (.md)')
    CSV = 'CSV', _('Comma-Separated Values (.csv)')
    OTHER = 'OTHER', _('Other / Unknown')


class Document(BaseModel):
    """
    Represents an organizational document entity within a Workspace.
    Maintains high-level metadata and references multiple historical versions.
    """
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='documents',
        help_text=_('The workspace this document belongs to.')
    )
    title = models.CharField(
        _('document title'),
        max_length=255,
        db_index=True,
        help_text=_('Human-readable title of the document.')
    )
    description = models.TextField(
        _('description'),
        blank=True,
        help_text=_('Optional summary of the document contents or purpose.')
    )
    file_type = models.CharField(
        _('file type'),
        max_length=20,
        choices=DocumentFileType.choices,
        default=DocumentFileType.OTHER,
        help_text=_('Format of the primary uploaded document.')
    )
    status = models.CharField(
        _('lifecycle status'),
        max_length=20,
        choices=DocumentStatus.choices,
        default=DocumentStatus.UPLOADED,
        db_index=True,
        help_text=_('Current processing and search-readiness status.')
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_documents',
        help_text=_('User who uploaded the initial version of this document.')
    )
    is_active = models.BooleanField(
        _('is active'),
        default=True,
        db_index=True,
        help_text=_('Controls whether this document is active or soft-deleted/archived.')
    )

    class Meta:
        verbose_name = _('document')
        verbose_name_plural = _('documents')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workspace', 'is_active', 'status']),
            models.Index(fields=['workspace', 'title']),
        ]

    def __str__(self):
        return f"{self.title} ({self.workspace.name})"

    @property
    def active_version(self):
        """
        Returns the currently active DocumentVersion record.
        """
        return self.versions.filter(is_active=True).order_by('-version_number').first()

    @property
    def total_versions_count(self) -> int:
        """
        Returns total number of versions stored for this document.
        """
        return self.versions.count()


class DocumentVersion(BaseModel):
    """
    Immutable versioned snapshot of an uploaded document file.
    Tracks SHA-256 hash for deduplication, file size, version number,
    and individual processing state.
    """
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='versions',
        help_text=_('The parent document this version belongs to.')
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_document_versions',
        help_text=_('User who uploaded this specific version.')
    )
    version_number = models.PositiveIntegerField(
        _('version number'),
        default=1,
        help_text=_('Sequential version number (e.g. 1, 2, 3...).')
    )
    file = models.FileField(
        _('document file'),
        upload_to=document_upload_path,
        max_length=500,
        help_text=_('The physical file stored in local storage or S3.')
    )
    original_filename = models.CharField(
        _('original filename'),
        max_length=255,
        help_text=_('The original filename as uploaded by the user.')
    )
    file_size_bytes = models.BigIntegerField(
        _('file size in bytes'),
        default=0,
        help_text=_('Exact size of the uploaded file in bytes.')
    )
    file_hash_sha256 = models.CharField(
        _('SHA-256 hash'),
        max_length=64,
        db_index=True,
        help_text=_('Cryptographic SHA-256 checksum for content deduplication & integrity.')
    )
    mime_type = models.CharField(
        _('MIME type'),
        max_length=100,
        blank=True,
        help_text=_('MIME type detected for this file (e.g. application/pdf).')
    )
    processing_status = models.CharField(
        _('processing status'),
        max_length=20,
        choices=DocumentStatus.choices,
        default=DocumentStatus.UPLOADED,
        db_index=True,
        help_text=_('Status of the ingestion/chunking pipeline for this version.')
    )
    error_message = models.TextField(
        _('error message'),
        blank=True,
        help_text=_('Error traceback if processing failed.')
    )
    is_active = models.BooleanField(
        _('is active version'),
        default=True,
        help_text=_('Whether this version is the active one used in RAG retrieval.')
    )
    change_summary = models.CharField(
        _('change summary'),
        max_length=255,
        blank=True,
        help_text=_('Optional note describing what changed in this version.')
    )

    class Meta:
        verbose_name = _('document version')
        verbose_name_plural = _('document versions')
        ordering = ['-version_number']
        unique_together = ('document', 'version_number')
        indexes = [
            models.Index(fields=['document', 'version_number']),
            models.Index(fields=['file_hash_sha256']),
        ]

    def __str__(self):
        return f"{self.document.title} - v{self.version_number}"
