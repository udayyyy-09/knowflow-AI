"""
Test Settings for KnowFlow AI.
Optimized for ultra-fast, isolated test execution with in-memory SQLite and dummy cache.
"""
from .base import *  # noqa: F403

DEBUG = False

# Use fast in-memory SQLite for testing
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Use local memory cache for tests
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
    }
}

# Faster password hashing for test speed
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# Eager Celery task execution for synchronous tests
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Mock Google Client ID for testing
GOOGLE_CLIENT_ID = 'test-google-client-id.apps.googleusercontent.com'
