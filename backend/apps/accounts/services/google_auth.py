"""
Google OAuth 2.0 Token Verification & Provisioning Service.

Handles secure verification of Google ID tokens received from the client
and provisions/authenticates user accounts accordingly.
"""
import logging
from typing import Dict, Any, Tuple
from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from google.oauth2 import id_token
from google.auth.transport import requests

from apps.accounts.models import User, AuthProvider

logger = logging.getLogger(__name__)


def verify_google_id_token(token_str: str) -> Dict[str, Any]:
    """
    Cryptographically verify a Google ID token using Google's public certificates.

    Args:
        token_str: The raw JWT ID token sent from the client (Google Identity Services).

    Returns:
        Dict[str, Any]: Decoded token payload containing user identity attributes.

    Raises:
        AuthenticationFailed: If the token is invalid, expired, or failed signature checks.
    """
    google_client_id = getattr(settings, 'GOOGLE_CLIENT_ID', None)
    if not google_client_id:
        logger.error("GOOGLE_CLIENT_ID is not configured in Django settings.")
        raise ValidationError("Google authentication is not properly configured on this server.")

    try:
        # Request object is used by google-auth to fetch Google's public keys & verify signatures
        request = requests.Request()
        payload = id_token.verify_oauth2_token(
            token_str,
            request,
            audience=google_client_id,
            clock_skew_in_seconds=10
        )

        # Validate issuer
        if payload.get('iss') not in ['accounts.google.com', 'https://accounts.google.com']:
            raise AuthenticationFailed("Invalid Google token issuer.")

        # Ensure the Google email has been verified by Google
        if not payload.get('email_verified', False):
            raise AuthenticationFailed("Google email address is not verified.")

        return payload

    except ValueError as e:
        logger.warning(f"Google ID token verification failed: {e}")
        raise AuthenticationFailed(f"Invalid Google ID token: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error verifying Google token: {e}", exc_info=True)
        raise AuthenticationFailed("Failed to verify Google token with authentication provider.")


def authenticate_or_register_google_user(payload: Dict[str, Any]) -> Tuple[User, bool]:
    """
    Authenticate an existing user or register a new user using verified Google payload data.

    Args:
        payload: The verified Google payload dictionary.

    Returns:
        Tuple[User, bool]: (user instance, created_boolean)
    """
    email = payload.get('email')
    google_id = payload.get('sub')
    first_name = payload.get('given_name', '')
    last_name = payload.get('family_name', '')
    avatar_url = payload.get('picture', '')

    if not email:
        raise ValidationError("Google payload is missing an email address.")

    user = None
    created = False

    # 1. Try finding user by google_id first
    if google_id:
        user = User.objects.filter(google_id=google_id).first()

    # 2. If not found by google_id, lookup by verified email
    if not user:
        user = User.objects.filter(email__iexact=email).first()
        if user:
            # Link Google ID to existing email/password account
            user.google_id = google_id
            if not user.avatar_url and avatar_url:
                user.avatar_url = avatar_url
            if not user.first_name and first_name:
                user.first_name = first_name
            if not user.last_name and last_name:
                user.last_name = last_name
            user.save(update_fields=['google_id', 'avatar_url', 'first_name', 'last_name'])
        else:
            # 3. Create a brand new Google-authenticated user
            user = User.objects.create_user(
                email=email,
                password=None,  # Google users have unusable passwords
                first_name=first_name,
                last_name=last_name,
                avatar_url=avatar_url,
                google_id=google_id,
                auth_provider=AuthProvider.GOOGLE,
            )
            created = True

    if not user.is_active:
        raise AuthenticationFailed("This user account has been disabled.")

    return user, created
