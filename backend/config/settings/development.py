"""
Development Settings for KnowFlow AI.
Extends base settings with developer-friendly defaults and verbose logging.
"""
from .base import *  # noqa: F403

DEBUG = True

# Allow all hosts in local development if needed
ALLOWED_HOSTS = ['*']

# Relax CORS in development if specified
CORS_ALLOW_ALL_ORIGINS = True

# Development Logging: output SQL and application logs to console
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} [{name}:{lineno}] {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}
