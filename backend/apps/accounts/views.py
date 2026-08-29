"""
Authentication & User Account API Views for KnowFlow AI.
"""
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    GoogleAuthSerializer,
    UserProfileSerializer,
    LogoutSerializer,
)


class RegisterView(generics.CreateAPIView):
    """
    POST /api/v1/auth/register/
    Register a new user account with email and password.
    Returns JWT access and refresh token pair upon successful registration.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        tokens = serializer.get_tokens(user)
        user_data = UserProfileSerializer(user).data

        return Response(
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


class LoginView(APIView):
    """
    POST /api/v1/auth/login/
    Authenticate with email and password. Returns JWT access and refresh tokens.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = UserLoginSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        tokens = serializer.get_tokens(None)
        user_data = serializer.get_user(None)

        return Response(
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


class GoogleAuthView(APIView):
    """
    POST /api/v1/auth/google/
    Authenticate or Register via Google OAuth 2.0 ID Token.
    Returns JWT tokens and user profile.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = GoogleAuthSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        tokens = serializer.get_tokens(None)
        user_data = serializer.get_user(None)
        is_new_user = serializer.is_new_user

        return Response(
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


class CustomTokenRefreshView(TokenRefreshView):
    """
    POST /api/v1/auth/refresh/
    Refresh an expired access token using a valid refresh token.
    Rotates the refresh token for enhanced security.
    """
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            return Response({
                "success": True,
                "message": "Token refreshed successfully.",
                "data": response.data,
            })
        return response


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Blacklist the provided refresh token, invalidating the session.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LogoutSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                "success": True,
                "message": "Successfully logged out. Refresh token has been blacklisted.",
            },
            status=status.HTTP_200_OK
        )


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
        return Response({
            "success": True,
            "data": serializer.data,
        })

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
