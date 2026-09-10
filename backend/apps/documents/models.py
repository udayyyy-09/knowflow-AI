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
from pgvector.django import VectorField
import pgvector.django


class HnswIndex(pgvector.django.HnswIndex):
    """
    HNSW index with PostgreSQL vendor safety for cross-environment testing.
    On PostgreSQL: creates HNSW vector index with cosine ops and m/ef parameters.
    On non-PostgreSQL (e.g. SQLite test runners): creates a standard index.
    """
    def create_sql(self, model, schema_editor, using="", **kwargs):
        if schema_editor.connection.vendor != "postgresql":
            return models.Index.create_sql(self, model, schema_editor, using="", **kwargs)
        return super().create_sql(model, schema_editor, using=using, **kwargs)




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


class DocumentChunk(BaseModel):
    """
    Extracted textual chunk from a specific DocumentVersion.
    Preserves document structure, page numbering, section headers, character counts,
    and metadata for vector embedding and retrieval.
    """
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='chunks',
        help_text=_('The document this chunk belongs to.')
    )
    version = models.ForeignKey(
        DocumentVersion,
        on_delete=models.CASCADE,
        related_name='chunks',
        help_text=_('The specific document version this chunk was extracted from.')
    )
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='document_chunks',
        help_text=_('Denormalized workspace reference for fast multi-tenant filtering.')
    )
    chunk_index = models.PositiveIntegerField(
        _('chunk index'),
        help_text=_('Zero-indexed sequential position of this chunk within the document version.')
    )
    content = models.TextField(
        _('content'),
        help_text=_('The extracted textual content of the chunk.')
    )
    page_number = models.PositiveIntegerField(
        _('page number'),
        null=True,
        blank=True,
        help_text=_('1-indexed page number if source is paginated (PDF), otherwise null.')
    )
    section_header = models.CharField(
        _('section header'),
        max_length=255,
        blank=True,
        help_text=_('Nearest preceding heading or section title.')
    )
    char_count = models.PositiveIntegerField(
        _('character count'),
        default=0,
        help_text=_('Number of characters in this chunk.')
    )
    token_count_estimate = models.PositiveIntegerField(
        _('estimated token count'),
        default=0,
        help_text=_('Approximated token count (~4 characters per token).')
    )
    metadata = models.JSONField(
        _('metadata'),
        default=dict,
        blank=True,
        help_text=_('Additional contextual metadata (e.g. source filename, language, custom tags).')
    )

    class Meta:
        verbose_name = _('document chunk')
        verbose_name_plural = _('document chunks')
        ordering = ['chunk_index']
        unique_together = ('version', 'chunk_index')
        indexes = [
            models.Index(fields=['workspace', 'document']),
            models.Index(fields=['version', 'chunk_index']),
        ]

    def __str__(self):
        return f"{self.document.title} [v{self.version.version_number}] - Chunk #{self.chunk_index}"


class Embedding(BaseModel):
    """
    Vector representation of a DocumentChunk for semantic similarity search in RAG.
    Stored using native pgvector VectorField and indexed via HNSW cosine distance.
    """
    chunk = models.OneToOneField(
        DocumentChunk,
        on_delete=models.CASCADE,
        related_name='embedding',
        help_text=_('The document chunk this vector embedding represents.')
    )
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='embeddings',
        help_text=_('Denormalized document reference for cascading and fast queries.')
    )
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='embeddings',
        help_text=_('Denormalized workspace reference for multi-tenant isolation.')
    )
    vector = VectorField(
        dimensions=getattr(settings, 'EMBEDDING_DIMENSIONS', 1536),
        help_text=_('Dense float vector representation.')
    )
    model_name = models.CharField(
        _('model name'),
        max_length=100,
        default='text-embedding-3-small',
        help_text=_('Embedding model used (e.g. text-embedding-3-small, text-embedding-004, bge-small-en-v1.5).')
    )
    dimensions = models.PositiveIntegerField(
        _('dimensions'),
        default=getattr(settings, 'EMBEDDING_DIMENSIONS', 1536),
        help_text=_('Vector dimensionality.')
    )
    is_active = models.BooleanField(
        _('is active'),
        default=True,
        help_text=_('Whether this embedding is active and searchable in RAG.')
    )

    class Meta:
        verbose_name = _('embedding')
        verbose_name_plural = _('embeddings')
        indexes = [
            models.Index(fields=['workspace', 'is_active']),
            models.Index(fields=['document', 'is_active']),
            HnswIndex(
                name='embedding_vector_hnsw_idx',
                fields=['vector'],
                m=16,
                ef_construction=64,
                opclasses=['vector_cosine_ops'],
            ),
        ]

    def __str__(self):
        return f"Embedding for Chunk #{self.chunk.chunk_index} ({self.model_name})"

