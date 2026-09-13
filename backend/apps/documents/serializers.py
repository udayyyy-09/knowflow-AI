"""
Serializers for Document Management in KnowFlow AI.
"""
from rest_framework import serializers
from django.db import transaction
from django.utils.text import slugify
import os
import mimetypes

from apps.accounts.serializers import UserProfileSerializer
from apps.documents.models import (
    Document,
    DocumentVersion,
    DocumentChunk,
    Embedding,
    DocumentStatus,
    DocumentFileType,
)
from apps.documents.validators import validate_document_file
from apps.documents.services.storage import calculate_file_sha256
from apps.documents.tasks import process_document_version


class DocumentChunkSerializer(serializers.ModelSerializer):
    """
    Serializer for viewing structured document chunks.
    """
    version_number = serializers.IntegerField(source='version.version_number', read_only=True)

    class Meta:
        model = DocumentChunk
        fields = [
            'id',
            'document_id',
            'version_id',
            'version_number',
            'workspace_id',
            'chunk_index',
            'content',
            'page_number',
            'section_header',
            'char_count',
            'token_count_estimate',
            'metadata',
            'created_at',
        ]
        read_only_fields = fields


class DocumentVersionSerializer(serializers.ModelSerializer):
    """
    Serializer for viewing DocumentVersion details.
    """
    uploaded_by = UserProfileSerializer(read_only=True)
    file_url = serializers.SerializerMethodField()
    chunks_count = serializers.SerializerMethodField()

    class Meta:
        model = DocumentVersion
        fields = [
            'id',
            'version_number',
            'original_filename',
            'file_size_bytes',
            'file_hash_sha256',
            'mime_type',
            'processing_status',
            'error_message',
            'is_active',
            'change_summary',
            'file_url',
            'chunks_count',
            'uploaded_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and hasattr(obj.file, 'url'):
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None

    def get_chunks_count(self, obj):
        return obj.chunks.count()


class DocumentListSerializer(serializers.ModelSerializer):
    """
    Compact serializer for listing documents in a workspace.
    """
    created_by = UserProfileSerializer(read_only=True)
    active_version = DocumentVersionSerializer(read_only=True)
    total_versions_count = serializers.IntegerField(read_only=True)
    chunks_count = serializers.SerializerMethodField()
    chunk_count = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'id',
            'workspace_id',
            'title',
            'description',
            'file_type',
            'status',
            'is_active',
            'total_versions_count',
            'chunks_count',
            'chunk_count',
            'active_version',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_chunks_count(self, obj):
        active_ver = obj.active_version
        if active_ver:
            return active_ver.chunks.count()
        return obj.chunks.count()

    def get_chunk_count(self, obj):
        return self.get_chunks_count(obj)


class DocumentDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer including full version history.
    """
    created_by = UserProfileSerializer(read_only=True)
    versions = DocumentVersionSerializer(many=True, read_only=True)
    active_version = DocumentVersionSerializer(read_only=True)
    total_versions_count = serializers.IntegerField(read_only=True)
    chunks_count = serializers.SerializerMethodField()
    chunk_count = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'id',
            'workspace_id',
            'title',
            'description',
            'file_type',
            'status',
            'is_active',
            'total_versions_count',
            'chunks_count',
            'chunk_count',
            'active_version',
            'versions',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_chunks_count(self, obj):
        active_ver = obj.active_version
        if active_ver:
            return active_ver.chunks.count()
        return obj.chunks.count()

    def get_chunk_count(self, obj):
        return self.get_chunks_count(obj)


class DocumentUploadSerializer(serializers.Serializer):
    """
    Handles initial document upload and creates Document + DocumentVersion (v1).
    """
    file = serializers.FileField(required=True, write_only=True)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)

    def validate_file(self, value):
        validate_document_file(value)
        return value

    def validate(self, attrs):
        file_obj = attrs['file']
        file_hash = calculate_file_sha256(file_obj)
        workspace = self.context['workspace']

        # Check for duplicate file in the same workspace
        existing_version = DocumentVersion.objects.filter(
            document__workspace=workspace,
            document__is_active=True,
            file_hash_sha256=file_hash
        ).first()

        if existing_version:
            attrs['duplicate_warning'] = (
                f"A document with identical content already exists: '{existing_version.document.title}' (v{existing_version.version_number})."
            )

        attrs['file_hash'] = file_hash
        return attrs

    def create(self, validated_data):
        file_obj = validated_data['file']
        file_hash = validated_data['file_hash']
        workspace = self.context['workspace']
        user = self.context['request'].user

        # Auto-determine title from filename if not provided
        raw_filename = file_obj.name
        title = validated_data.get('title')
        if not title or not title.strip():
            title = os.path.splitext(raw_filename)[0].replace('_', ' ').replace('-', ' ').title()

        description = validated_data.get('description', '')

        # Map file extension to DocumentFileType
        ext = os.path.splitext(raw_filename)[1].lower().lstrip('.')
        file_type_map = {
            'pdf': DocumentFileType.PDF,
            'docx': DocumentFileType.DOCX,
            'txt': DocumentFileType.TXT,
            'md': DocumentFileType.MD,
            'csv': DocumentFileType.CSV,
        }
        file_type = file_type_map.get(ext, DocumentFileType.OTHER)
        mime_type = mimetypes.guess_type(raw_filename)[0] or 'application/octet-stream'

        with transaction.atomic():
            document = Document.objects.create(
                 workspace=workspace,
                 title=title,
                 description=description,
                 file_type=file_type,
                 status=DocumentStatus.QUEUED,
                 created_by=user,
                 is_active=True,
             )

            version = DocumentVersion.objects.create(
                 document=document,
                 uploaded_by=user,
                 version_number=1,
                 file=file_obj,
                 original_filename=raw_filename,
                 file_size_bytes=file_obj.size,
                 file_hash_sha256=file_hash,
                 mime_type=mime_type,
                 processing_status=DocumentStatus.QUEUED,
                 is_active=True,
                 change_summary="Initial document upload",
             )

            version_id_str = str(version.id)
            transaction.on_commit(lambda: process_document_version.delay(version_id_str))

        return document


class DocumentVersionCreateSerializer(serializers.Serializer):
    """
    Handles uploading a new version (v2, v3...) to an existing Document.
    """
    file = serializers.FileField(required=True, write_only=True)
    change_summary = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate_file(self, value):
        validate_document_file(value)
        return value

    def create(self, validated_data):
        file_obj = validated_data['file']
        change_summary = validated_data.get('change_summary', '')
        document = self.context['document']
        user = self.context['request'].user

        file_hash = calculate_file_sha256(file_obj)
        raw_filename = file_obj.name
        mime_type = mimetypes.guess_type(raw_filename)[0] or 'application/octet-stream'

        # Map file extension to DocumentFileType
        ext = os.path.splitext(raw_filename)[1].lower().lstrip('.')
        file_type_map = {
            'pdf': DocumentFileType.PDF,
            'docx': DocumentFileType.DOCX,
            'txt': DocumentFileType.TXT,
            'md': DocumentFileType.MD,
            'csv': DocumentFileType.CSV,
        }
        file_type = file_type_map.get(ext, DocumentFileType.OTHER)

        with transaction.atomic():
            # Get latest version number
            latest_version = document.versions.order_by('-version_number').first()
            new_version_number = (latest_version.version_number + 1) if latest_version else 1

            # Deactivate previous active versions
            document.versions.filter(is_active=True).update(is_active=False)

            # Create new active version
            new_version = DocumentVersion.objects.create(
                document=document,
                uploaded_by=user,
                version_number=new_version_number,
                file=file_obj,
                original_filename=raw_filename,
                file_size_bytes=file_obj.size,
                file_hash_sha256=file_hash,
                mime_type=mime_type,
                processing_status=DocumentStatus.QUEUED,
                is_active=True,
                change_summary=change_summary or f"Updated to version {new_version_number}",
            )

            # Update parent document status & file type
            document.status = DocumentStatus.QUEUED
            document.file_type = file_type
            document.save(update_fields=['status', 'file_type', 'updated_at'])

            version_id_str = str(new_version.id)
            transaction.on_commit(lambda: process_document_version.delay(version_id_str))

        return new_version


class EmbeddingSerializer(serializers.ModelSerializer):
    """
    Serializer for viewing Embedding metadata.
    """
    chunk_index = serializers.IntegerField(source='chunk.chunk_index', read_only=True)

    class Meta:
        model = Embedding
        fields = [
            'id',
            'chunk_id',
            'chunk_index',
            'document_id',
            'workspace_id',
            'model_name',
            'dimensions',
            'is_active',
            'created_at',
        ]
        read_only_fields = fields


class VectorSearchQuerySerializer(serializers.Serializer):
    """
    Serializer for validating semantic search requests.
    """
    query = serializers.CharField(
        required=True,
        min_length=1,
        max_length=2000,
        help_text="User question or query string for semantic vector search."
    )
    top_k = serializers.IntegerField(
        required=False,
        default=5,
        min_value=1,
        max_value=50,
        help_text="Maximum number of relevant chunks to retrieve (1-50, default 5)."
    )
    min_score = serializers.FloatField(
        required=False,
        default=0.0,
        min_value=0.0,
        max_value=1.0,
        help_text="Minimum cosine similarity score threshold (0.0 to 1.0, default 0.0)."
    )
    document_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        allow_empty=True,
        help_text="Optional list of document IDs to scope search within."
    )


class VectorSearchResultSerializer(serializers.Serializer):
    """
    Serializer for formatting individual semantic search hit results.
    """
    chunk_id = serializers.UUIDField()
    chunk_index = serializers.IntegerField()
    content = serializers.CharField()
    page_number = serializers.IntegerField(allow_null=True)
    section_header = serializers.CharField(allow_blank=True)
    metadata = serializers.DictField()
    document_id = serializers.UUIDField()
    document_title = serializers.CharField()
    version_id = serializers.UUIDField()
    version_number = serializers.IntegerField()
    similarity_score = serializers.FloatField()
    cosine_distance = serializers.FloatField()

