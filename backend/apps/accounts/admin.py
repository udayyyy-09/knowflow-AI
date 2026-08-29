"""
Django Admin Configuration for Custom User Model.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from apps.accounts.models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Custom Admin for User model using email instead of username.
    """
    list_display = (
        'email',
        'first_name',
        'last_name',
        'auth_provider',
        'is_staff',
        'is_active',
        'date_joined',
    )
    list_filter = ('auth_provider', 'is_staff', 'is_superuser', 'is_active', 'groups')
    search_fields = ('email', 'first_name', 'last_name', 'google_id')
    ordering = ('-date_joined',)

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Personal info'), {'fields': ('first_name', 'last_name', 'avatar_url')}),
        (_('OAuth info'), {'fields': ('auth_provider', 'google_id')}),
        (
            _('Permissions'),
            {
                'fields': (
                    'is_active',
                    'is_staff',
                    'is_superuser',
                    'groups',
                    'user_permissions',
                ),
            },
        ),
        (_('Important dates'), {'fields': ('last_login', 'date_joined')}),
    )

    add_fieldsets = (
        (
            None,
            {
                'classes': ('wide',),
                'fields': ('email', 'password', 'first_name', 'last_name', 'auth_provider'),
            },
        ),
    )
