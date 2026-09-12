"""
Celery tasks for Workspace operations and Email Invitations.
"""
import logging
from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

from apps.workspaces.models import WorkspaceInvitation

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    name='apps.workspaces.tasks.send_workspace_invitation_email'
)
def send_workspace_invitation_email(self, invitation_id: str):
    """
    Renders and delivers a secure HTML invitation email to an invited team member.
    """
    try:
        invitation = WorkspaceInvitation.objects.select_related('workspace', 'invited_by').get(id=invitation_id)
    except WorkspaceInvitation.DoesNotExist:
        logger.error("WorkspaceInvitation %s not found for email delivery.", invitation_id)
        return False

    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    invite_url = f"{frontend_url}/#invite={invitation.token}"

    inviter_name = invitation.invited_by.get_full_name() or invitation.invited_by.email
    context = {
        'workspace_name': invitation.workspace.name,
        'workspace_description': invitation.workspace.description,
        'inviter_name': inviter_name,
        'inviter_email': invitation.invited_by.email,
        'role': invitation.role,
        'invite_url': invite_url,
        'expires_at_formatted': invitation.expires_at.strftime('%B %d, %Y at %H:%M UTC'),
    }

    subject = f"You're invited to join {invitation.workspace.name} on KnowFlow AI"
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'KnowFlow AI <noreply@knowflow.ai>')
    to_email = [invitation.email]

    html_content = render_to_string('emails/workspace_invitation.html', context)
    text_content = render_to_string('emails/workspace_invitation.txt', context)

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=to_email
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)
        logger.info("Successfully sent invitation email to %s for workspace '%s'", invitation.email, invitation.workspace.name)
        return True
    except OSError as net_err:
        logger.error(
            "Network error sending invitation email to %s: %s. "
            "Tip: On Render, standard SMTP port 25/587 can fail with [Errno 101] Network is unreachable. "
            "Set RESEND_API_KEY for HTTP API delivery or use EMAIL_USE_SSL=True on port 465.",
            invitation.email, str(net_err)
        )
        countdown = 30 * (2 ** self.request.retries)
        raise self.retry(exc=net_err, countdown=countdown)
    except Exception as exc:
        logger.error("Failed sending invitation email to %s: %s", invitation.email, str(exc), exc_info=True)
        countdown = 30 * (2 ** self.request.retries)
        raise self.retry(exc=exc, countdown=countdown)
