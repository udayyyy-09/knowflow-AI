"""
Custom Email Backends for KnowFlow AI.
Provides:
1. ResendAPIBackend: HTTP/HTTPS REST API delivery via Resend (avoids cloud SMTP port blocks & IPv6 routing issues).
2. IPv4SafeSMTPBackend: Forces IPv4 DNS resolution for standard SMTP to avoid [Errno 101] Network is unreachable on Render/AWS/Linux.
3. SmartEmailBackend: Automatically selects Resend API if RESEND_API_KEY is configured, otherwise uses IPv4SafeSMTPBackend.
"""
import logging
import socket
import smtplib
import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.backends.smtp import EmailBackend as DjangoSMTPBackend
from django.core.mail.backends.console import EmailBackend as DjangoConsoleBackend

logger = logging.getLogger(__name__)


def create_ipv4_connection(address, timeout=socket._GLOBAL_DEFAULT_TIMEOUT, source_address=None):
    """
    Connect to an address forcing IPv4 (AF_INET) to prevent [Errno 101] Network is unreachable
    in environments without IPv6 outbound routing (e.g. Render, Docker, AWS).
    """
    host, port = address
    err = None
    # Force AF_INET (IPv4 only)
    for res in socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM):
        af, socktype, proto, canonname, sa = res
        sock = None
        try:
            sock = socket.socket(af, socktype, proto)
            if timeout is not socket._GLOBAL_DEFAULT_TIMEOUT:
                sock.settimeout(timeout)
            if source_address:
                sock.bind(source_address)
            sock.connect(sa)
            return sock
        except OSError as e:
            err = e
            if sock is not None:
                sock.close()
    if err is not None:
        raise err
    raise OSError("getaddrinfo returns an empty list for IPv4")


class IPv4SMTP(smtplib.SMTP):
    """SMTP subclass that forces IPv4 socket connection."""
    def _get_socket(self, host, port, timeout):
        if self.debuglevel > 0:
            self._print_debug('connect: to', (host, port), self.source_address)
        return create_ipv4_connection((host, port), timeout, self.source_address)


class IPv4SMTP_SSL(smtplib.SMTP_SSL):
    """SMTP_SSL subclass that forces IPv4 socket connection."""
    def _get_socket(self, host, port, timeout):
        import ssl
        if self.debuglevel > 0:
            self._print_debug('connect: to', (host, port), self.source_address)
        new_socket = create_ipv4_connection((host, port), timeout, self.source_address)
        ctx = getattr(self, 'context', None) or getattr(self, '_context', None) or ssl.create_default_context()
        server_hostname = getattr(self, '_host', None) or getattr(self, 'host', None) or host
        return ctx.wrap_socket(new_socket, server_hostname=server_hostname)


class IPv4SafeSMTPBackend(DjangoSMTPBackend):
    """
    Django SMTP Email Backend that strictly uses IPv4 sockets to avoid
    [Errno 101] Network is unreachable when cloud providers lack IPv6 routing.
    """
    @property
    def connection_class(self):
        return IPv4SMTP_SSL if self.use_ssl else IPv4SMTP


class ResendAPIBackend(BaseEmailBackend):
    """
    HTTP/HTTPS REST API Email Backend using Resend (https://resend.com).
    Bypasses all outbound SMTP port blocks (port 25/587/465) completely.
    """
    RESEND_API_URL = "https://api.resend.com/emails"

    def __init__(self, api_key=None, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.api_key = api_key or getattr(settings, 'RESEND_API_KEY', '')

    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        if not self.api_key:
            error_msg = "RESEND_API_KEY is not configured in environment or settings."
            logger.error(error_msg)
            if not self.fail_silently:
                raise ValueError(error_msg)
            return 0

        num_sent = 0
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "KnowFlow-AI/1.0",
        }

        for message in email_messages:
            try:
                # Extract HTML alternative if present
                html_body = None
                if hasattr(message, 'alternatives'):
                    for content, mimetype in message.alternatives:
                        if mimetype == 'text/html':
                            html_body = content
                            break

                from_email = message.from_email or getattr(settings, 'DEFAULT_FROM_EMAIL', 'onboarding@resend.dev')
                # Format from_email if default is noreply@knowflow.ai on unverified domain in Resend
                if not getattr(settings, 'VERIFIED_EMAIL_DOMAIN', False):
                    if '@knowflow.ai' in from_email or not from_email:
                        from_email = 'KnowFlow AI <onboarding@resend.dev>'

                payload = {
                    "from": from_email,
                    "to": list(message.to),
                    "subject": message.subject,
                    "text": message.body,
                }
                if html_body:
                    payload["html"] = html_body
                if message.cc:
                    payload["cc"] = list(message.cc)
                if message.bcc:
                    payload["bcc"] = list(message.bcc)
                if message.reply_to:
                    payload["reply_to"] = list(message.reply_to)

                response = requests.post(
                    self.RESEND_API_URL,
                    headers=headers,
                    json=payload,
                    timeout=15
                )

                if response.status_code in (200, 201):
                    num_sent += 1
                    logger.info("Resend API dispatched email '%s' to %s (ID: %s)", message.subject, message.to, response.json().get('id'))
                else:
                    err_msg = f"Resend API error (Status {response.status_code}): {response.text}"
                    logger.error(err_msg)
                    if not self.fail_silently:
                        raise Exception(err_msg)
            except Exception as e:
                logger.error("Failed sending message via Resend API: %s", e, exc_info=True)
                if not self.fail_silently:
                    raise

        return num_sent


class SmartEmailBackend(BaseEmailBackend):
    """
    Intelligent Email Backend that routes:
    1. Resend API if RESEND_API_KEY is present in settings.
    2. IPv4SafeSMTPBackend if EMAIL_HOST is configured with credentials.
    3. Console backend for local development when no credentials are provided.
    """
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        resend_key = getattr(settings, 'RESEND_API_KEY', '')
        email_host = getattr(settings, 'EMAIL_HOST', '')
        email_user = getattr(settings, 'EMAIL_HOST_USER', '')
        is_debug = getattr(settings, 'DEBUG', True)

        if resend_key:
            self.backend = ResendAPIBackend(api_key=resend_key, fail_silently=fail_silently)
        elif email_host and (email_user or not is_debug):
            self.backend = IPv4SafeSMTPBackend(fail_silently=fail_silently)
        else:
            self.backend = DjangoConsoleBackend(fail_silently=fail_silently)

    def send_messages(self, email_messages):
        return self.backend.send_messages(email_messages)
