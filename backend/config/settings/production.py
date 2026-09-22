"""
Production Settings for KnowFlow AI.
Enforces SSL, strict security headers, and production-grade logging.
"""
from .base import *  # noqa: F403

DEBUG = False

# Ensure SECRET_KEY and ALLOWED_HOSTS are strictly set via environment
if not ALLOWED_HOSTS or ALLOWED_HOSTS == ['*']:
    raise ValueError("ALLOWED_HOSTS must be explicitly defined with valid domain names in production.")

# WhiteNoise Static Asset Serving
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
] + [m for m in MIDDLEWARE if m != 'django.middleware.security.SecurityMiddleware']  # noqa: F405

STATIC_ROOT = BASE_DIR / 'staticfiles'  # noqa: F405
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Security Hardening
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = env.bool('SECURE_SSL_REDIRECT', default=False)  # noqa: F405
# NOTE: Render terminates SSL at its load balancer. Gunicorn receives plain HTTP
# internally. SECURE_SSL_REDIRECT must be False here — Django trusts HTTPS via
# the SECURE_PROXY_SSL_HEADER ('HTTP_X_FORWARDED_PROTO', 'https') set above.
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
JWT_COOKIE_SECURE = env.bool('JWT_COOKIE_SECURE', default=True)  # noqa: F405
JWT_COOKIE_SAMESITE = env('JWT_COOKIE_SAMESITE', default='None')  # noqa: F405 (Default 'None' enables cross-origin Vercel->Render HTTPS cookies)
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Disable Browsable API in production for cleaner security footprint
REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'] = (  # noqa: F405
    'rest_framework.renderers.JSONRenderer',
)

# Production Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {
            'format': '%(asctime)s %(levelname)s %(name)s %(message)s',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'apps': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
