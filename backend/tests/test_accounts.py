"""
Automated Tests for Accounts & Authentication API endpoints.
"""
import pytest
from unittest.mock import patch
from django.urls import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User, AuthProvider


@pytest.mark.django_db
class TestRegistration:
    """Test suite for user registration."""

    def test_register_user_success(self, api_client):
        url = reverse('auth:register')
        payload = {
            "email": "newuser@knowflow.ai",
            "password": "SecurePassword123!",
            "first_name": "John",
            "last_name": "Doe"
        }
        response = api_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["success"] is True
        assert "tokens" in response.data["data"]
        assert "access" in response.data["data"]["tokens"]
        assert "refresh" in response.data["data"]["tokens"]
        assert response.data["data"]["user"]["email"] == "newuser@knowflow.ai"
        assert response.data["data"]["user"]["auth_provider"] == AuthProvider.EMAIL

        # Verify in database
        user = User.objects.get(email="newuser@knowflow.ai")
        assert user.check_password("SecurePassword123!") is True

    def test_register_duplicate_email_fails(self, api_client, user_factory):
        user_factory(email="existing@knowflow.ai")
        url = reverse('auth:register')
        payload = {
            "email": "existing@knowflow.ai",
            "password": "SecurePassword123!",
        }
        response = api_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["success"] is False
        assert response.data["error"]["code"] == "VALIDATION_ERROR"

    def test_register_weak_password_fails(self, api_client):
        url = reverse('auth:register')
        payload = {
            "email": "weak@knowflow.ai",
            "password": "123",  # Too short
        }
        response = api_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["success"] is False

    def test_create_user_without_email_fails(self):
        with pytest.raises(ValueError, match="The Email field must be set"):
            User.objects.create_user(email="")

    def test_create_superuser_success(self):
        admin_user = User.objects.create_superuser(
            email="superadmin@knowflow.ai",
            password="AdminPassword123!"
        )
        assert admin_user.is_staff is True
        assert admin_user.is_superuser is True
        assert admin_user.is_active is True

    def test_create_superuser_invalid_flags_fails(self):
        with pytest.raises(ValueError, match="Superuser must have is_staff=True"):
            User.objects.create_superuser(
                email="badadmin@knowflow.ai",
                password="AdminPassword123!",
                is_staff=False
            )

        with pytest.raises(ValueError, match="Superuser must have is_superuser=True"):
            User.objects.create_superuser(
                email="badadmin2@knowflow.ai",
                password="AdminPassword123!",
                is_superuser=False
            )

        with pytest.raises(ValueError, match="Superuser must have a password"):
            User.objects.create_superuser(
                email="badadmin3@knowflow.ai",
                password=None
            )


@pytest.mark.django_db
class TestLogin:
    """Test suite for email/password authentication."""

    def test_login_success(self, api_client, user_factory):
        user_factory(email="loginuser@knowflow.ai", password="ValidPassword123!")
        url = reverse('auth:login')
        payload = {
            "email": "loginuser@knowflow.ai",
            "password": "ValidPassword123!"
        }
        response = api_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True
        assert "tokens" in response.data["data"]
        assert response.data["data"]["user"]["email"] == "loginuser@knowflow.ai"

    def test_login_invalid_password_fails(self, api_client, user_factory):
        user_factory(email="loginuser@knowflow.ai", password="ValidPassword123!")
        url = reverse('auth:login')
        payload = {
            "email": "loginuser@knowflow.ai",
            "password": "WrongPassword999!"
        }
        response = api_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["success"] is False


@pytest.mark.django_db
class TestTokenRefreshAndLogout:
    """Test suite for JWT token rotation and blacklisting."""

    def test_token_refresh_success(self, api_client, user):
        refresh = RefreshToken.for_user(user)
        url = reverse('auth:token-refresh')
        response = api_client.post(url, {"refresh": str(refresh)}, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data["data"]

    def test_logout_blacklists_token(self, auth_client, user, api_client):
        refresh = RefreshToken.for_user(user)
        logout_url = reverse('auth:logout')
        response = auth_client.post(logout_url, {"refresh": str(refresh)}, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True

        # Attempting to refresh with the blacklisted token should fail
        refresh_url = reverse('auth:token-refresh')
        refresh_response = api_client.post(refresh_url, {"refresh": str(refresh)}, format='json')
        assert refresh_response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED]


@pytest.mark.django_db
class TestGoogleOAuth:
    """Test suite for Google OAuth ID Token verification and provisioning."""

    @patch('apps.accounts.serializers.verify_google_id_token')
    def test_google_auth_new_user_success(self, mock_verify, api_client):
        mock_verify.return_value = {
            "email": "googleuser@gmail.com",
            "sub": "google-oauth2-1234567890",
            "given_name": "Google",
            "family_name": "Tester",
            "picture": "https://lh3.googleusercontent.com/a/photo.jpg",
            "email_verified": True,
            "iss": "accounts.google.com",
        }

        url = reverse('auth:google-login')
        response = api_client.post(url, {"id_token": "mocked-valid-google-id-token"}, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["success"] is True
        assert response.data["data"]["is_new_user"] is True
        assert response.data["data"]["user"]["email"] == "googleuser@gmail.com"
        assert response.data["data"]["user"]["auth_provider"] == AuthProvider.GOOGLE
        assert "tokens" in response.data["data"]

        # Verify user in database
        user = User.objects.get(email="googleuser@gmail.com")
        assert user.google_id == "google-oauth2-1234567890"
        assert user.has_usable_password() is False

    @patch('apps.accounts.serializers.verify_google_id_token')
    def test_google_auth_existing_user_links_account(self, mock_verify, api_client, user_factory):
        existing_user = user_factory(
            email="existing_google@gmail.com",
            first_name="Jane",
            last_name="Doe",
            auth_provider=AuthProvider.EMAIL
        )

        mock_verify.return_value = {
            "email": "existing_google@gmail.com",
            "sub": "google-oauth2-9876543210",
            "given_name": "Jane",
            "family_name": "Doe",
            "picture": "https://lh3.googleusercontent.com/a/jane.jpg",
            "email_verified": True,
            "iss": "accounts.google.com",
        }

        url = reverse('auth:google-login')
        response = api_client.post(url, {"id_token": "mocked-valid-google-id-token"}, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True
        assert response.data["data"]["is_new_user"] is False

        existing_user.refresh_from_db()
        assert existing_user.google_id == "google-oauth2-9876543210"

    def test_google_auth_invalid_token_rejected(self, api_client):
        url = reverse('auth:google-login')
        response = api_client.post(url, {"id_token": "completely-invalid-token"}, format='json')

        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED]
        assert response.data["success"] is False


@pytest.mark.django_db
class TestUserProfile:
    """Test suite for /api/v1/auth/me/ endpoint."""

    def test_get_current_user_profile(self, auth_client, user):
        url = reverse('auth:me')
        response = auth_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True
        assert response.data["data"]["email"] == user.email
        assert response.data["data"]["first_name"] == user.first_name

    def test_update_current_user_profile(self, auth_client, user):
        url = reverse('auth:me')
        response = auth_client.patch(url, {"first_name": "UpdatedAlice"}, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"]["first_name"] == "UpdatedAlice"
        user.refresh_from_db()
        assert user.first_name == "UpdatedAlice"
