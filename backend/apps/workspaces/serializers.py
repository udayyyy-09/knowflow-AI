"""
Serializers for Workspaces and Workspace Memberships.
"""
from django.db import transaction
from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.serializers import UserProfileSerializer
from apps.workspaces.models import (
    Workspace,
    WorkspaceMembership,
    WorkspaceRole,
    WorkspaceInvitation,
    InvitationStatus,
)


class WorkspaceMembershipSerializer(serializers.ModelSerializer):
    """
    Serializer for displaying a workspace member and their assigned role.
    """
    user = UserProfileSerializer(read_only=True)

    class Meta:
        model = WorkspaceMembership
        fields = ('id', 'workspace_id', 'user', 'role', 'created_at', 'updated_at')
        read_only_fields = ('id', 'workspace_id', 'created_at', 'updated_at')


class WorkspaceSerializer(serializers.ModelSerializer):
    """
    Serializer for retrieving and updating workspace details.
    Includes computed properties such as member count and the requesting user's role.
    """
    member_count = serializers.SerializerMethodField()
    current_user_role = serializers.SerializerMethodField()
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)

    class Meta:
        model = Workspace
        fields = (
            'id',
            'name',
            'slug',
            'description',
            'is_active',
            'created_by',
            'created_by_email',
            'member_count',
            'current_user_role',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'slug', 'created_by', 'created_by_email', 'created_at', 'updated_at')

    def get_member_count(self, obj):
        return obj.memberships.count()

    def get_current_user_role(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.get_member_role(request.user)
        return None


class WorkspaceCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating a new Workspace.
    Automatically assigns the creator as the Workspace ADMIN in an atomic transaction.
    """
    class Meta:
        model = Workspace
        fields = ('id', 'name', 'slug', 'description', 'created_at')
        read_only_fields = ('id', 'created_at')
        extra_kwargs = {
            'slug': {'required': False},
            'description': {'required': False},
        }

    def create(self, validated_data):
        user = self.context['request'].user
        with transaction.atomic():
            workspace = Workspace.objects.create(created_by=user, **validated_data)
            # Assign creator as ADMIN
            WorkspaceMembership.objects.create(
                workspace=workspace,
                user=user,
                role=WorkspaceRole.ADMIN
            )
        return workspace


class WorkspaceMemberAddSerializer(serializers.Serializer):
    """
    Serializer for inviting/adding an existing user to a workspace by email.
    """
    email = serializers.EmailField(required=True)
    role = serializers.ChoiceField(
        choices=WorkspaceRole.choices,
        default=WorkspaceRole.EMPLOYEE
    )

    def validate_email(self, value):
        normalized_email = value.lower().strip()
        user = User.objects.filter(email__iexact=normalized_email).first()
        if not user:
            raise serializers.ValidationError(
                f"No user found with email '{value}'. User must register first."
            )
        workspace = self.context['workspace']
        if WorkspaceMembership.objects.filter(workspace=workspace, user=user).exists():
            raise serializers.ValidationError(
                f"User '{value}' is already a member of this workspace."
            )
        self.target_user = user
        return normalized_email

    def create(self, validated_data):
        workspace = self.context['workspace']
        role = validated_data.get('role', WorkspaceRole.EMPLOYEE)
        membership = WorkspaceMembership.objects.create(
            workspace=workspace,
            user=self.target_user,
            role=role
        )
        return membership


class WorkspaceMemberUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating a member's role within a workspace.
    """
    class Meta:
        model = WorkspaceMembership
        fields = ('role',)

    def validate(self, attrs):
        membership = self.instance
        new_role = attrs.get('role')

        # Prevent removing the last admin in a workspace
        if membership.role == WorkspaceRole.ADMIN and new_role != WorkspaceRole.ADMIN:
            admin_count = WorkspaceMembership.objects.filter(
                workspace=membership.workspace,
                role=WorkspaceRole.ADMIN
            ).count()
            if admin_count <= 1:
                raise serializers.ValidationError(
                    "Cannot demote the only administrator of this workspace."
                )

        return attrs


class WorkspaceInvitationSerializer(serializers.ModelSerializer):
    """
    Serializer for displaying workspace invitations in the workspace management roster.
    Ommits the raw cryptographic token to prevent credential exposure (OWASP API3).
    """
    invited_by_email = serializers.EmailField(source='invited_by.email', read_only=True)
    invited_by_name = serializers.SerializerMethodField()

    class Meta:
        model = WorkspaceInvitation
        fields = (
            'id',
            'workspace_id',
            'email',
            'role',
            'status',
            'invited_by_email',
            'invited_by_name',
            'expires_at',
            'created_at',
            'accepted_at',
        )
        read_only_fields = (
            'id',
            'workspace_id',
            'status',
            'invited_by_email',
            'invited_by_name',
            'expires_at',
            'created_at',
            'accepted_at',
        )

    def get_invited_by_name(self, obj):
        return obj.invited_by.get_full_name() or obj.invited_by.email


class WorkspaceInvitationCreateSerializer(serializers.Serializer):
    """
    Serializer for creating a new cryptographically signed email invitation.
    """
    email = serializers.EmailField(required=True)
    role = serializers.ChoiceField(
        choices=WorkspaceRole.choices,
        default=WorkspaceRole.EMPLOYEE
    )

    def validate_email(self, value):
        normalized = value.lower().strip()
        workspace = self.context['workspace']

        # Check if user is already a member of this workspace
        existing_member = WorkspaceMembership.objects.filter(
            workspace=workspace,
            user__email__iexact=normalized
        ).exists()
        if existing_member:
            raise serializers.ValidationError(
                f"User with email '{value}' is already an active member of this workspace."
            )

        return normalized


class WorkspaceInvitationPublicSerializer(serializers.Serializer):
    """
    Public serializer for previewing invitation details before accepting.
    """
    token = serializers.CharField()
    workspace_name = serializers.CharField()
    workspace_description = serializers.CharField(allow_blank=True)
    inviter_name = serializers.CharField()
    inviter_email = serializers.CharField()
    role = serializers.CharField()
    email = serializers.EmailField()
    expires_at = serializers.DateTimeField()
    is_valid = serializers.BooleanField()

