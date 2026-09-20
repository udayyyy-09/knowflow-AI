"""
Custom Authentication Classes for KnowFlow AI.
Supports dual-mode authentication:
1. HttpOnly Cookie Authentication with CSRF double-submit verification
2. Authorization: Bearer <token> header fallback (Automated tests, CLI tools, external API consumers)
"""
from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from rest_framework.exceptions import PermissionDenied

from apps.accounts.csrf import validate_csrf_double_submit


class CookieJWTAuthentication(JWTAuthentication):
    """
    Extends SimpleJWT's JWTAuthentication to inspect HttpOnly cookies first,
    falling back to the standard Authorization: Bearer header.
    
    When authenticating via HttpOnly cookie for unsafe/mutating HTTP methods,
    automatically verifies the double-submit CSRF token (X-CSRF-Token header == knowflow_csrf cookie).
    """

    def authenticate(self, request):
        request.auth_source = None

        # 1. Attempt extracting token from Cookie
        raw_token = (
            request.COOKIES.get(getattr(settings, 'JWT_ACCESS_COOKIE_NAME', 'knowflow_access_token'))
            or request.COOKIES.get('__Secure-knowflow_access')
            or request.COOKIES.get('access_token')
        )

        if raw_token:
            try:
                validated_token = self.get_validated_token(raw_token)
                user = self.get_user(validated_token)
                request.auth_source = 'cookie'

                # Enforce CSRF double-submit token on mutating methods for cookie-authenticated sessions
                if request.method not in ('GET', 'HEAD', 'OPTIONS', 'TRACE'):
                    if not validate_csrf_double_submit(request):
                        raise PermissionDenied("CSRF double-submit verification failed: X-CSRF-Token missing or invalid.")

                return (user, validated_token)
            except (InvalidToken, AuthenticationFailed, PermissionDenied) as exc:
                raise exc

        # 2. Fall back to standard Authorization: Bearer header
        header = self.get_header(request)
        if header is None:
            return None

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)
        request.auth_source = 'header'
        return (user, validated_token)
