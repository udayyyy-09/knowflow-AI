"""
Serializers for Accounts & Authentication.
Includes User Registration, Email/Password Login, Google OAuth, Profile, and Token management.
"""
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from apps.accounts.models import User, AuthProvider
from apps.accounts.services.google_auth import verify_google_id_token, authenticate_or_register_google_user


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for retrieving and updating user profile data.
    """
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = (
            'id',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'avatar_url',
            'auth_provider',
            'is_staff',
            'date_joined',
        )
        read_only_fields = ('id', 'email', 'auth_provider', 'is_staff', 'date_joined')


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for registering a new user with email and password.
    """
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        help_text="Password must meet Django's security requirements."
    )
    tokens = serializers.SerializerMethodField()
    user = UserProfileSerializer(source='*', read_only=True)

    class Meta:
        model = User
        fields = ('id', 'email', 'password', 'first_name', 'last_name', 'tokens', 'user')
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
        }

    def validate_password(self, value):
        """Validate password against configured Django password validators."""
        validate_password(value)
        return value

    def validate_email(self, value):
        """Ensure email is unique case-insensitively."""
        normalized_email = value.lower().strip()
        if User.objects.filter(email__iexact=normalized_email).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return normalized_email

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            auth_provider=AuthProvider.EMAIL,
        )
        return user

    def get_tokens(self, obj):
        refresh = RefreshToken.for_user(obj)
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }


class UserLoginSerializer(serializers.Serializer):
    """
    Serializer for authenticating existing users via email and password.
    """
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    tokens = serializers.SerializerMethodField(read_only=True)
    user = serializers.SerializerMethodField(read_only=True)

    def validate(self, attrs):
        email = attrs.get('email', '').lower().strip()
        password = attrs.get('password')

        user = authenticate(
            request=self.context.get('request'),
            username=email,
            password=password
        )

        if not user:
            # Check if user exists but registered via Google OAuth
            existing_user = User.objects.filter(email__iexact=email).first()
            if existing_user and existing_user.auth_provider == AuthProvider.GOOGLE and not existing_user.has_usable_password():
                raise serializers.ValidationError(
                    "This account was created with Google Sign-In. Please sign in using Google."
                )
            raise serializers.ValidationError("Invalid email or password.")

        if not user.is_active:
            raise serializers.ValidationError("This user account is inactive or disabled.")

        self.user_instance = user
        return attrs

    def get_tokens(self, obj):
        refresh = RefreshToken.for_user(self.user_instance)
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }

    def get_user(self, obj):
        return UserProfileSerializer(self.user_instance).data


class GoogleAuthSerializer(serializers.Serializer):
    """
    Serializer for handling Google OAuth Sign-In via ID token or Google credential.
    """
    id_token = serializers.CharField(
        required=False,
        write_only=True,
        help_text="The JWT ID token obtained from Google Identity Services on the frontend."
    )
    credential = serializers.CharField(
        required=False,
        write_only=True,
        help_text="The credential string returned by Google Identity Services."
    )
    tokens = serializers.SerializerMethodField(read_only=True)
    user = serializers.SerializerMethodField(read_only=True)
    is_new_user = serializers.BooleanField(read_only=True)

    def validate(self, attrs):
        token_str = attrs.get('id_token') or attrs.get('credential')
        if not token_str:
            raise serializers.ValidationError("Either 'id_token' or 'credential' must be provided.")

        payload = verify_google_id_token(token_str)
        user, created = authenticate_or_register_google_user(payload)

        self.user_instance = user
        self.is_new_user = created
        return attrs

    def get_tokens(self, obj):
        refresh = RefreshToken.for_user(self.user_instance)
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }

    def get_user(self, obj):
        return UserProfileSerializer(self.user_instance).data

    def to_representation(self, instance):
        return {
            'tokens': self.get_tokens(instance),
            'user': self.get_user(instance),
            'is_new_user': self.is_new_user,
        }


class LogoutSerializer(serializers.Serializer):
    """
    Serializer for logging out and blacklisting the JWT refresh token.
    """
    refresh = serializers.CharField(required=True)

    def validate(self, attrs):
        self.token = attrs['refresh']
        return attrs

    def save(self, **kwargs):
        try:
            RefreshToken(self.token).blacklist()
        except TokenError as e:
            raise serializers.ValidationError({"refresh": f"Invalid or expired refresh token: {str(e)}"})
