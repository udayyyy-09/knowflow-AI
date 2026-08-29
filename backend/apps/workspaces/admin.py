"""
Django Admin Configuration for Workspaces and Memberships.
"""
from django.contrib import admin
from apps.workspaces.models import Workspace, WorkspaceMembership


class WorkspaceMembershipInline(admin.TabularInline):
    """
    Inline membership editor within the Workspace admin page.
    """
    model = WorkspaceMembership
    extra = 1
    autocomplete_fields = ('user',)
    fields = ('user', 'role', 'created_at')
    readonly_fields = ('created_at',)


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    """
    Admin configuration for Workspace model.
    """
    list_display = ('name', 'slug', 'created_by', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'slug', 'description', 'created_by__email')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [WorkspaceMembershipInline]
    ordering = ('-created_at',)


@admin.register(WorkspaceMembership)
class WorkspaceMembershipAdmin(admin.ModelAdmin):
    """
    Admin configuration for individual Workspace Memberships.
    """
    list_display = ('user', 'workspace', 'role', 'created_at')
    list_filter = ('role', 'workspace__is_active')
    search_fields = ('user__email', 'workspace__name')
    autocomplete_fields = ('user', 'workspace')
    ordering = ('-created_at',)
