"""
Custom Authentication Classes for KnowFlow AI.
Supports dual-mode authentication:
1. Authorization: Bearer <token> header (primary — most reliable for proxy deployments)
2. HttpOnly Cookie Authentication with CSRF double-submit verification (fallback)
"""
from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from rest_framework.exceptions import PermissionDenied

from apps.accounts.csrf import validate_csrf_double_submit


class CookieJWTAuthentication(JWTAuthentication):
    """
    Extends SimpleJWT's JWTAuthentication to support both Bearer token and HttpOnly cookie auth.

    Priority:
      1. Authorization: Bearer <token> header — used when frontend stores tokens in sessionStorage
         (most reliable for Vercel → Render reverse-proxy setups)
      2. HttpOnly Cookie — fallback for cookie-based sessions; enforces CSRF double-submit on
         mutating methods.

    If the cookie token is present but invalid/expired, the authenticator falls through to the
    Bearer header rather than raising immediately, allowing seamless dual-mode operation.
    """

    def authenticate(self, request):
        request.auth_source = None

        # ── 1. Try Authorization: Bearer header first ────────────────────────
        # This is the primary method when the frontend stores tokens in sessionStorage.
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token is not None:
                try:
                    validated_token = self.get_validated_token(raw_token)
                    user = self.get_user(validated_token)
                    request.auth_source = 'header'
                    return (user, validated_token)
                except (InvalidToken, AuthenticationFailed):
                    # Bearer token invalid — fall through to cookie auth
                    pass

        # ── 2. Fall back to HttpOnly Cookie ──────────────────────────────────
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
                        raise PermissionDenied(
                            "CSRF double-submit verification failed: X-CSRF-Token missing or invalid."
                        )

                return (user, validated_token)
            except (InvalidToken, AuthenticationFailed) as exc:
                # Cookie token invalid/expired — return None so DRF issues a proper 401
                return None
            except PermissionDenied as exc:
                raise exc

        return None
