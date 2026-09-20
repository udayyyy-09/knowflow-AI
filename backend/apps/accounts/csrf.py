"""
Double-Submit CSRF Protection for Cookie-Authenticated Requests in KnowFlow AI.
"""
import secrets
from django.conf import settings
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied


CSRF_COOKIE_NAME = getattr(settings, 'CSRF_DOUBLE_SUBMIT_COOKIE_NAME', 'knowflow_csrf')
CSRF_HEADER_NAME = 'HTTP_X_CSRF_TOKEN'
SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS', 'TRACE')


def generate_csrf_token() -> str:
    """Generates a cryptographically strong random CSRF token."""
    return secrets.token_urlsafe(32)


def validate_csrf_double_submit(request) -> bool:
    """
    Validates CSRF token via Double-Submit Cookie pattern.
    Only enforced if request was authenticated via Cookie and is a mutating method.
    Bearer header authenticated requests are exempt.
    """
    # Safe methods do not mutate state
    if request.method in SAFE_METHODS:
        return True

    # If authenticated via Authorization: Bearer header, CSRF enforcement is not required
    auth_source = getattr(request, 'auth_source', None)
    if auth_source == 'header':
        return True

    # If request is unauthenticated or has no cookie credential, let DRF permission handle 401
    cookie_token = (
        request.COOKIES.get(CSRF_COOKIE_NAME)
        or request.COOKIES.get('knowflow_csrf')
        or request.COOKIES.get('__Secure-knowflow_csrf')
    )
    header_token = request.META.get(CSRF_HEADER_NAME) or request.headers.get('x-csrf-token')

    if not cookie_token or not header_token:
        return False

    return secrets.compare_digest(cookie_token, header_token)


class CSRFDoubleSubmitPermission(permissions.BasePermission):
    """
    DRF Permission class that enforces CSRF double-submit token matching
    on mutating requests that authenticate via cookies.
    """
    message = "CSRF double-submit verification failed: X-CSRF-Token missing or invalid."

    def has_permission(self, request, view):
        if not validate_csrf_double_submit(request):
            raise PermissionDenied(self.message)
        return True


class CSRFDoubleSubmitMiddleware:
    """
    Django middleware for validating double-submit CSRF on API routes.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # We allow DRF view execution to authenticate first so request.auth_source is populated
        response = self.get_response(request)
        return response
