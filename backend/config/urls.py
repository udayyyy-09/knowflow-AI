"""
KnowFlow AI — Top-Level URL Configuration.

Routes:
- /admin/               -> Django Administration Console
- /health/              -> System Health Check Endpoint
- /api/v1/auth/         -> Authentication & Account Management (Email/Password + Google OAuth)
- /api/v1/workspaces/   -> Workspace Isolation & RBAC Membership Management
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.shortcuts import render
from django.conf import settings
from django.db import connection
from django.core.cache import cache
from django.views.generic import TemplateView


def health_check(request):
    """
    Health check endpoint for Docker containers, load balancers, and monitoring.
    Verifies database and redis cache connectivity.
    """
    db_ok = True
    db_error = None
    try:
        connection.ensure_connection()
    except Exception as e:
        db_ok = False
        db_error = str(e)

    redis_ok = True
    redis_error = None
    try:
        cache.set('__healthcheck__', '1', timeout=5)
        redis_ok = (cache.get('__healthcheck__') == '1')
    except Exception as e:
        redis_ok = False
        redis_error = str(e)

    is_healthy = db_ok and redis_ok
    status_code = 200 if is_healthy else 503

    return JsonResponse(
        {
            "status": "healthy" if is_healthy else "unhealthy",
            "services": {
                "database": {"status": "up" if db_ok else "down", "error": db_error},
                "cache_redis": {"status": "up" if redis_ok else "down", "error": redis_error},
            },
        },
        status=status_code
    )


def test_playground(request):
    """
    Renders the interactive test client playground with settings context.
    """
    return render(
        request,
        'test_client.html',
        {
            'google_client_id': getattr(settings, 'GOOGLE_CLIENT_ID', ''),
        }
    )


urlpatterns = [
    path('', test_playground, name='test-playground'),
    path('admin/', admin.site.urls),
    path('health/', health_check, name='health-check'),
    path('api/v1/auth/', include('apps.accounts.urls', namespace='auth')),
    path('api/v1/workspaces/', include('apps.workspaces.urls', namespace='workspaces')),
]
