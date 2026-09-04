"""
Serializers for Document Management in KnowFlow AI.
"""
from rest_framework import serializers
from django.db import transaction
from django.utils.text import slugify
import os
import mimetypes

from apps.accounts.serializers import UserProfileSerializer
from apps.documents.models import Document, DocumentVersion, DocumentStatus, DocumentFileType
from apps.documents.validators import validate_document_file
from apps.documents.services.storage import calculate_file_sha256


class DocumentVersionSerializer(serializers.ModelSerializer):
    """
    Serializer for viewing DocumentVersion details.
    """
    uploaded_by = UserProfileSerializer(read_only=True)
    file_url = serializers.SerializerMethodField()

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


class DocumentListSerializer(serializers.ModelSerializer):
    """
    Compact serializer for listing documents in a workspace.
    """
    created_by = UserProfileSerializer(read_only=True)
    active_version = DocumentVersionSerializer(read_only=True)
    total_versions_count = serializers.IntegerField(read_only=True)

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
            'active_version',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class DocumentDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer including full version history.
    """
    created_by = UserProfileSerializer(read_only=True)
    versions = DocumentVersionSerializer(many=True, read_only=True)
    active_version = DocumentVersionSerializer(read_only=True)

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
            'active_version',
            'versions',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


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
                status=DocumentStatus.UPLOADED,
                created_by=user,
                is_active=True,
            )

            DocumentVersion.objects.create(
                document=document,
                uploaded_by=user,
                version_number=1,
                file=file_obj,
                original_filename=raw_filename,
                file_size_bytes=file_obj.size,
                file_hash_sha256=file_hash,
                mime_type=mime_type,
                processing_status=DocumentStatus.UPLOADED,
                is_active=True,
                change_summary="Initial document upload",
            )

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
                processing_status=DocumentStatus.UPLOADED,
                is_active=True,
                change_summary=change_summary or f"Updated to version {new_version_number}",
            )

            # Update parent document status & file type
            document.status = DocumentStatus.UPLOADED
            document.file_type = file_type
            document.save(update_fields=['status', 'file_type', 'updated_at'])

        return new_version
