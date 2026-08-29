"""
Workspace & Membership Models for KnowFlow AI.

Implements multi-tenant workspace isolation and Role-Based Access Control (RBAC).
"""
from django.db import models
from django.conf import settings
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _
import uuid

from apps.common.models import BaseModel


class WorkspaceRole(models.TextChoices):
    """
    Role definitions within a workspace:
    - ADMIN: Full administrative control (workspace settings, member invitations/removals, documents, chat).
    - MANAGER: Content control (document uploads, document versioning, viewing analytics, chat).
    - EMPLOYEE: Standard user (search, RAG queries, viewing authorized documents, conversation history).
    """
    ADMIN = 'ADMIN', _('Admin')
    MANAGER = 'MANAGER', _('Manager')
    EMPLOYEE = 'EMPLOYEE', _('Employee')


class Workspace(BaseModel):
    """
    A tenant boundary that isolates documents, embeddings, conversations, and access permissions.
    """
    name = models.CharField(
        _('workspace name'),
        max_length=255,
        help_text=_('Display name of the workspace (e.g., HR & People, Engineering, Finance).')
    )
    slug = models.SlugField(
        _('slug'),
        max_length=255,
        unique=True,
        db_index=True,
        help_text=_('URL-friendly unique identifier for the workspace.')
    )
    description = models.TextField(
        _('description'),
        blank=True,
        help_text=_('Optional summary of the knowledge domain contained in this workspace.')
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_workspaces',
        help_text=_('The user who originally created this workspace.')
    )
    is_active = models.BooleanField(
        _('is active'),
        default=True,
        help_text=_('Controls whether this workspace is currently operational.')
    )

    class Meta:
        verbose_name = _('workspace')
        verbose_name_plural = _('workspaces')
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """Auto-generate slug if not provided, ensuring uniqueness."""
        if not self.slug:
            base_slug = slugify(self.name) or 'workspace'
            unique_slug = base_slug
            counter = 1
            while Workspace.objects.filter(slug=unique_slug).exclude(id=self.id).exists():
                unique_slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = unique_slug
        super().save(*args, **kwargs)

    def get_member_role(self, user):
        """
        Return the role string for a given user in this workspace, or None if not a member.
        """
        if not user or not user.is_authenticated:
            return None
        membership = self.memberships.filter(user=user).first()
        return membership.role if membership else None


class WorkspaceMembership(BaseModel):
    """
    Associates a User with a Workspace and assigns their specific RBAC role.
    """
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='memberships',
        help_text=_('The workspace the user belongs to.')
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='workspace_memberships',
        help_text=_('The member user.')
    )
    role = models.CharField(
        _('role'),
        max_length=20,
        choices=WorkspaceRole.choices,
        default=WorkspaceRole.EMPLOYEE,
        help_text=_('Access level granted to the user within this workspace.')
    )

    class Meta:
        verbose_name = _('workspace membership')
        verbose_name_plural = _('workspace memberships')
        unique_together = ('workspace', 'user')
        indexes = [
            models.Index(fields=['workspace', 'user']),
            models.Index(fields=['user', 'role']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.workspace.name} ({self.role})"
