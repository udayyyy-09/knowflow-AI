"""
Django Admin Configuration for Document Management.
"""
from django.contrib import admin
from django.utils.html import format_html
from apps.documents.models import Document, DocumentVersion


class DocumentVersionInline(admin.TabularInline):
    model = DocumentVersion
    extra = 0
    fields = [
        'version_number',
        'original_filename',
        'file_size_bytes',
        'file_hash_sha256',
        'processing_status',
        'is_active',
        'uploaded_by',
        'created_at',
    ]
    readonly_fields = [
        'version_number',
        'file_size_bytes',
        'file_hash_sha256',
        'processing_status',
        'uploaded_by',
        'created_at',
    ]
    can_delete = False


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = [
        'title',
        'workspace',
        'file_type',
        'status_badge',
        'versions_count',
        'created_by',
        'is_active',
        'created_at',
    ]
    list_filter = ['workspace', 'status', 'file_type', 'is_active']
    search_fields = ['title', 'description', 'workspace__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    inlines = [DocumentVersionInline]

    def status_badge(self, obj):
        colors = {
            'UPLOADED': '#6366f1',
            'QUEUED': '#f59e0b',
            'PROCESSING': '#06b6d4',
            'EMBEDDING': '#8b5cf6',
            'READY': '#10b981',
            'FAILED': '#ef4444',
            'ARCHIVED': '#6b7280',
        }
        color = colors.get(obj.status, '#6b7280')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 500; font-size: 11px;">{}</span>',
            color,
            obj.status
        )
    status_badge.short_description = 'Status'

    def versions_count(self, obj):
        return obj.total_versions_count
    versions_count.short_description = 'Versions'


@admin.register(DocumentVersion)
class DocumentVersionAdmin(admin.ModelAdmin):
    list_display = [
        'document',
        'version_number',
        'original_filename',
        'file_size_bytes',
        'file_hash_sha256',
        'processing_status',
        'is_active',
        'uploaded_by',
        'created_at',
    ]
    list_filter = ['processing_status', 'is_active', 'document__workspace']
    search_fields = ['original_filename', 'file_hash_sha256', 'document__title']
    readonly_fields = ['id', 'created_at', 'updated_at']
