"""
Custom User Models for KnowFlow AI.

Features:
- UUID Primary Key via BaseModel.
- Email as the unique username identifier.
- Multi-provider support (Email/Password and Google OAuth).
- First-class compatibility with Django's PermissionsMixin & SimpleJWT.
"""
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.common.models import BaseModel
from apps.accounts.managers import CustomUserManager


class AuthProvider(models.TextChoices):
    """
    Supported authentication providers for user accounts.
    """
    EMAIL = 'email', _('Email and Password')
    GOOGLE = 'google', _('Google OAuth')


class User(AbstractBaseUser, PermissionsMixin, BaseModel):
    """
    Primary user identity model for KnowFlow AI.

    Inherits from:
    - AbstractBaseUser: Core authentication fields (password, last_login)
    - PermissionsMixin: Groups and user permissions for Django Admin & RBAC
    - BaseModel: UUID 'id', 'created_at', and 'updated_at' timestamps
    """
    email = models.EmailField(
        _('email address'),
        unique=True,
        db_index=True,
        help_text=_('Required. Must be a valid, unique email address.')
    )
    first_name = models.CharField(
        _('first name'),
        max_length=150,
        blank=True,
        help_text=_('User given name.')
    )
    last_name = models.CharField(
        _('last name'),
        max_length=150,
        blank=True,
        help_text=_('User family name.')
    )
    avatar_url = models.URLField(
        _('avatar URL'),
        max_length=500,
        blank=True,
        null=True,
        help_text=_('Profile picture URL (e.g. from Google profile).')
    )
    auth_provider = models.CharField(
        _('auth provider'),
        max_length=20,
        choices=AuthProvider.choices,
        default=AuthProvider.EMAIL,
        help_text=_('The primary authentication method used by this account.')
    )
    google_id = models.CharField(
        _('Google User ID'),
        max_length=255,
        blank=True,
        null=True,
        unique=True,
        db_index=True,
        help_text=_('Unique subject identifier provided by Google OAuth.')
    )

    # Standard Django user flags
    is_staff = models.BooleanField(
        _('staff status'),
        default=False,
        help_text=_('Designates whether the user can log into the Django admin site.')
    )
    is_active = models.BooleanField(
        _('active'),
        default=True,
        help_text=_('Designates whether this user account should be treated as active.')
    )
    date_joined = models.DateTimeField(
        _('date joined'),
        default=timezone.now
    )

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []  # Email & Password are required by default

    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')
        ordering = ['-created_at']

    def __str__(self):
        return self.email

    def get_full_name(self):
        """Return the first_name plus the last_name, with a space in between."""
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name or self.email

    def get_short_name(self):
        """Return the short name for the user."""
        return self.first_name or self.email.split('@')[0]
