"""
Authentication & User Account API Views for KnowFlow AI.
Supports both HttpOnly cookie issuance and Bearer token responses.
"""
from django.conf import settings
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

from apps.accounts.csrf import generate_csrf_token
from apps.accounts.serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    GoogleAuthSerializer,
    UserProfileSerializer,
)


def get_cookie_settings():
    """Returns standardized cookie configuration parameters."""
    is_prod = not getattr(settings, 'DEBUG', True)
    return {
        'access_name': getattr(settings, 'JWT_ACCESS_COOKIE_NAME', 'knowflow_access_token'),
        'refresh_name': getattr(settings, 'JWT_REFRESH_COOKIE_NAME', 'knowflow_refresh_token'),
        'csrf_name': getattr(settings, 'CSRF_DOUBLE_SUBMIT_COOKIE_NAME', 'knowflow_csrf'),
        'secure': getattr(settings, 'JWT_COOKIE_SECURE', is_prod),
        'samesite': getattr(settings, 'JWT_COOKIE_SAMESITE', 'None' if is_prod else 'Lax'),
        'domain': getattr(settings, 'JWT_COOKIE_DOMAIN', None),
        'access_max_age': int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        'refresh_max_age': int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
    }


def set_jwt_cookies(response: Response, access_token: str, refresh_token: str = None) -> Response:
    """
    Sets secure HttpOnly JWT cookies and double-submit CSRF token on the response.
    Lifetimes are derived dynamically from SIMPLE_JWT settings to prevent drift.
    """
    cfg = get_cookie_settings()

    # 1. HttpOnly Access Token Cookie
    response.set_cookie(
        key=cfg['access_name'],
        value=access_token,
        max_age=cfg['access_max_age'],
        httponly=True,
        secure=cfg['secure'],
        samesite=cfg['samesite'],
        domain=cfg['domain'],
        path='/',
    )

    # 2. HttpOnly Refresh Token Cookie
    if refresh_token:
        response.set_cookie(
            key=cfg['refresh_name'],
            value=refresh_token,
            max_age=cfg['refresh_max_age'],
            httponly=True,
            secure=cfg['secure'],
            samesite=cfg['samesite'],
            domain=cfg['domain'],
            path='/',
        )

    # 3. Non-HttpOnly CSRF Cookie (readable by JavaScript to attach in X-CSRF-Token header)
    csrf_token = generate_csrf_token()
    response.set_cookie(
        key=cfg['csrf_name'],
        value=csrf_token,
        max_age=cfg['refresh_max_age'],
        httponly=False,
        secure=cfg['secure'],
        samesite=cfg['samesite'],
        domain=cfg['domain'],
        path='/',
    )
    response['X-CSRF-Token'] = csrf_token

    return response


def clear_jwt_cookies(response: Response) -> Response:
    """
    Clears all JWT and CSRF cookies with byte-identical path, domain, and samesite flags.
    """
    cfg = get_cookie_settings()

    response.delete_cookie(
        key=cfg['access_name'],
        path='/',
        domain=cfg['domain'],
        samesite=cfg['samesite'],
    )
    response.delete_cookie(
        key=cfg['refresh_name'],
        path='/',
        domain=cfg['domain'],
        samesite=cfg['samesite'],
    )
    response.delete_cookie(
        key=cfg['csrf_name'],
        path='/',
        domain=cfg['domain'],
        samesite=cfg['samesite'],
    )
    return response


class RegisterView(generics.CreateAPIView):
    """
    POST /api/v1/auth/register/
    Register a new user account with email and password.
    Returns JWT tokens in JSON payload and sets secure HttpOnly cookies.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        tokens = serializer.get_tokens(user)
        user_data = UserProfileSerializer(user).data

        response = Response(
            {
                "success": True,
                "message": "User registered successfully.",
                "data": {
                    "user": user_data,
                    "tokens": tokens,
                },
            },
            status=status.HTTP_201_CREATED
        )
        return set_jwt_cookies(response, tokens['access'], tokens.get('refresh'))


class LoginView(APIView):
    """
    POST /api/v1/auth/login/
    Authenticate with email and password.
    Returns JWT tokens in JSON payload and sets secure HttpOnly cookies.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = UserLoginSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        tokens = serializer.get_tokens(None)
        user_data = serializer.get_user(None)

        response = Response(
            {
                "success": True,
                "message": "Login successful.",
                "data": {
                    "user": user_data,
                    "tokens": tokens,
                },
            },
            status=status.HTTP_200_OK
        )
        return set_jwt_cookies(response, tokens['access'], tokens.get('refresh'))


class GoogleAuthView(APIView):
    """
    POST /api/v1/auth/google/
    Authenticate or Register via Google OAuth 2.0 ID Token.
    Returns JWT tokens and user profile, and sets secure HttpOnly cookies.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = GoogleAuthSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        tokens = serializer.get_tokens(None)
        user_data = serializer.get_user(None)
        is_new_user = serializer.is_new_user

        response = Response(
            {
                "success": True,
                "message": "Google authentication successful.",
                "data": {
                    "user": user_data,
                    "tokens": tokens,
                    "is_new_user": is_new_user,
                },
            },
            status=status.HTTP_200_OK if not is_new_user else status.HTTP_201_CREATED
        )
        return set_jwt_cookies(response, tokens['access'], tokens.get('refresh'))


from rest_framework_simplejwt.exceptions import InvalidToken

class CustomTokenRefreshView(TokenRefreshView):
    """
    POST /api/v1/auth/refresh/
    Refresh an expired access token using a valid refresh token.
    Reads refresh token from HttpOnly cookie or request body,
    rotates refresh token, and updates HttpOnly cookies.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data or {})
        cfg = get_cookie_settings()

        # If refresh token not in body, read from HttpOnly cookie
        if 'refresh' not in data or not data['refresh']:
            cookie_refresh = request.COOKIES.get(cfg['refresh_name']) or request.COOKIES.get('refresh_token')
            if cookie_refresh:
                data['refresh'] = cookie_refresh

        serializer = self.get_serializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])

        token_data = serializer.validated_data

        new_access = token_data.get('access')
        new_refresh = token_data.get('refresh') or data.get('refresh')

        response = Response({
            "success": True,
            "message": "Token refreshed successfully.",
            "data": token_data,
        }, status=status.HTTP_200_OK)

        return set_jwt_cookies(response, new_access, new_refresh)


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Blacklist the provided refresh token and clear all JWT/CSRF cookies.
    Clears cookies even if the token was already expired or blacklisted.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        cfg = get_cookie_settings()
        refresh_token = (
            request.data.get('refresh')
            or request.COOKIES.get(cfg['refresh_name'])
            or request.COOKIES.get('refresh_token')
        )

        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except (TokenError, Exception):
                # Token may be expired or already blacklisted; proceed with cookie deletion
                pass

        response = Response(
            {
                "success": True,
                "message": "Successfully logged out. Refresh token has been blacklisted.",
            },
            status=status.HTTP_200_OK
        )
        return clear_jwt_cookies(response)


class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    GET /api/v1/auth/me/
    PATCH /api/v1/auth/me/
    Retrieve or update the currently authenticated user's profile.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get_object(self):
        return self.request.user

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        response = Response({
            "success": True,
            "data": serializer.data,
        })
        # If knowflow_csrf cookie is missing, issue a fresh one
        cfg = get_cookie_settings()
        if not request.COOKIES.get(cfg['csrf_name']):
            csrf_token = generate_csrf_token()
            response.set_cookie(
                key=cfg['csrf_name'],
                value=csrf_token,
                max_age=cfg['refresh_max_age'],
                httponly=False,
                secure=cfg['secure'],
                samesite=cfg['samesite'],
                domain=cfg['domain'],
                path='/',
            )
            response['X-CSRF-Token'] = csrf_token
        return response

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        return Response({
            "success": True,
            "message": "Profile updated successfully.",
            "data": serializer.data,
        })
