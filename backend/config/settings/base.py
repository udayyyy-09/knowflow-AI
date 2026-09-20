"""
Base Settings for KnowFlow AI.
Shared across development, testing, and production environments.
"""
import os
from datetime import timedelta
from pathlib import Path
import environ

# -----------------------------------------------------------------------------
# Base Directories & Environment Initialization
# -----------------------------------------------------------------------------
# BASE_DIR points to the 'backend/' root directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    SECRET_KEY=(str, 'django-insecure-default-change-me-knowflow'),
    ALLOWED_HOSTS=(list, ['localhost', '127.0.0.1']),
)

# Read .env file if present in BASE_DIR or root
env_file = BASE_DIR / '.env'
if env_file.is_file():
    environ.Env.read_env(str(env_file))
else:
    root_env = BASE_DIR.parent / '.env'
    if root_env.is_file():
        environ.Env.read_env(str(root_env))

# -----------------------------------------------------------------------------
# Core Security Settings
# -----------------------------------------------------------------------------
SECRET_KEY = env('DJANGO_SECRET_KEY', default=env('SECRET_KEY'))
DEBUG = env('DEBUG')
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1', '[::1]'])

# -----------------------------------------------------------------------------
# Application Definition
# -----------------------------------------------------------------------------
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'pgvector.django',
]

LOCAL_APPS = [
    'apps.common',
    'apps.accounts',
    'apps.workspaces',
    'apps.documents',
    'apps.chat',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# -----------------------------------------------------------------------------
# Middleware Configuration
# -----------------------------------------------------------------------------
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',            # CORS must be near the top
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.accounts.middleware.AuthSourceHeaderMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

# -----------------------------------------------------------------------------
# Database Configuration (PostgreSQL + pgvector)
# -----------------------------------------------------------------------------
DATABASES = {
    'default': env.db(
        'DATABASE_URL',
        default='postgres://udaychaudhary:knowflow_secret@localhost:5432/knowflow_db'
    )
}

# -----------------------------------------------------------------------------
# Custom User Model
# -----------------------------------------------------------------------------
AUTH_USER_MODEL = 'accounts.User'

# -----------------------------------------------------------------------------
# Password Validation
# -----------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# -----------------------------------------------------------------------------
# Internationalization & Localization
# -----------------------------------------------------------------------------
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# -----------------------------------------------------------------------------
# Static & Media Files
# -----------------------------------------------------------------------------
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Storage Configuration (Supabase S3 / Local filesystem)
USE_S3 = env.bool('USE_S3', default=False)

if USE_S3:
    INSTALLED_APPS += ['storages']
    AWS_ACCESS_KEY_ID = env('AWS_ACCESS_KEY_ID', default='')
    AWS_SECRET_ACCESS_KEY = env('AWS_SECRET_ACCESS_KEY', default='')
    AWS_STORAGE_BUCKET_NAME = env('AWS_STORAGE_BUCKET_NAME', default='knowflow-files')
    AWS_S3_ENDPOINT_URL = env('AWS_S3_ENDPOINT_URL', default='')
    AWS_S3_REGION_NAME = env('AWS_S3_REGION_NAME', default='us-east-1')
    AWS_S3_SIGNATURE_VERSION = 's3v4'
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = True

    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
            "OPTIONS": {
                "access_key": AWS_ACCESS_KEY_ID,
                "secret_key": AWS_SECRET_ACCESS_KEY,
                "bucket_name": AWS_STORAGE_BUCKET_NAME,
                "endpoint_url": AWS_S3_ENDPOINT_URL,
                "region_name": AWS_S3_REGION_NAME,
                "signature_version": AWS_S3_SIGNATURE_VERSION,
                "file_overwrite": AWS_S3_FILE_OVERWRITE,
                "default_acl": AWS_DEFAULT_ACL,
                "querystring_auth": AWS_QUERYSTRING_AUTH,
            },
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
else:
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }

# -----------------------------------------------------------------------------
# Default Primary Key Field Type
# -----------------------------------------------------------------------------
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# -----------------------------------------------------------------------------
# -----------------------------------------------------------------------------
# Django REST Framework Configuration
# -----------------------------------------------------------------------------
REST_FRAMEWORK = {
    # Dual-mode authentication: HttpOnly cookies first, Authorization: Bearer fallback
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.accounts.authentication.CookieJWTAuthentication',
    ),
    # Require authentication by default for all API endpoints unless explicitly decorated,
    # with CSRF double-submit token verification on cookie-authenticated mutating requests
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
        'apps.accounts.csrf.CSRFDoubleSubmitPermission',
    ),
    # Standardized JSON response formatting and browsing capability
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ),
    # Custom pagination with dynamic page size query parameters
    'DEFAULT_PAGINATION_CLASS': 'apps.common.pagination.StandardResultsSetPagination',
    'PAGE_SIZE': 20,
    # Unified custom exception handler for uniform error JSON contracts
    'EXCEPTION_HANDLER': 'apps.common.exceptions.custom_exception_handler',
}

# -----------------------------------------------------------------------------
# SimpleJWT & Cookie Configuration
# -----------------------------------------------------------------------------
ACCESS_TOKEN_MINUTES = env.int('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', default=60)
REFRESH_TOKEN_DAYS = env.int('JWT_REFRESH_TOKEN_LIFETIME_DAYS', default=14)

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=ACCESS_TOKEN_MINUTES),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=REFRESH_TOKEN_DAYS),
    'ROTATE_REFRESH_TOKENS': True,              # Return new refresh token on refresh
    'BLACKLIST_AFTER_ROTATION': True,          # Invalidate old refresh token
    'UPDATE_LAST_LOGIN': True,                 # Update User.last_login on auth
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
}

# Cookie Security & Lifecycle Configuration
JWT_COOKIE_SECURE = env.bool('JWT_COOKIE_SECURE', default=False)
JWT_COOKIE_SAMESITE = env('JWT_COOKIE_SAMESITE', default='Lax')  # 'Lax' (standard/custom domain), 'None' (cross-origin HTTPS)
JWT_COOKIE_DOMAIN = env('JWT_COOKIE_DOMAIN', default=None)        # e.g., '.knowflow.ai'
JWT_ACCESS_COOKIE_NAME = 'knowflow_access_token'
JWT_REFRESH_COOKIE_NAME = 'knowflow_refresh_token'
CSRF_DOUBLE_SUBMIT_COOKIE_NAME = 'knowflow_csrf'

# Startup Validation: SameSite='None' must always be paired with Secure=True in modern browsers
if JWT_COOKIE_SAMESITE.lower() == 'none' and not JWT_COOKIE_SECURE:
    raise ValueError("JWT_COOKIE_SECURE must be True when JWT_COOKIE_SAMESITE='None' for browser cookie compliance.")

# -----------------------------------------------------------------------------
# Google OAuth Configuration
# -----------------------------------------------------------------------------
GOOGLE_CLIENT_ID = env('GOOGLE_CLIENT_ID', default='')
GOOGLE_CLIENT_SECRET = env('GOOGLE_CLIENT_SECRET', default='')

# -----------------------------------------------------------------------------
# CORS (Cross-Origin Resource Sharing) Configuration
# -----------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env.list(
    'CORS_ALLOWED_ORIGINS',
    default=[
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ]
)
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.vercel\.app$",
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-csrf-token',
    'x-requested-with',
]
CORS_EXPOSE_HEADERS = [
    'content-disposition',
    'content-length',
    'content-type',
    'x-auth-source',
    'x-csrf-token',
]

# -----------------------------------------------------------------------------
# Celery & Redis Configuration
# -----------------------------------------------------------------------------
REDIS_URL = env('REDIS_URL', default='redis://localhost:6379/0')
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default=REDIS_URL)
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', default=REDIS_URL)
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes max per task
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True

# -----------------------------------------------------------------------------
# Cache Configuration (Redis)
# -----------------------------------------------------------------------------
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_URL,
    }
}

# -----------------------------------------------------------------------------
# Embeddings & Vector Search Configuration
# -----------------------------------------------------------------------------
EMBEDDING_PROVIDER = env('EMBEDDING_PROVIDER', default='gemini')  # 'huggingface', 'gemini', 'local', 'openai', 'mock'
EMBEDDING_MODEL_NAME = env(
    'EMBEDDING_MODEL_NAME',
    default='BAAI/bge-small-en-v1.5' if EMBEDDING_PROVIDER in ['local', 'fastembed', 'huggingface'] else 'text-embedding-004'
)
EMBEDDING_DIMENSIONS = env.int(
    'EMBEDDING_DIMENSIONS',
    default=384 if EMBEDDING_PROVIDER in ['local', 'fastembed', 'huggingface'] else 768
)
EMBEDDING_BATCH_SIZE = env.int('EMBEDDING_BATCH_SIZE', default=64)
EMBEDDING_TIMEOUT_SECONDS = env.int('EMBEDDING_TIMEOUT_SECONDS', default=30)
OPENAI_API_KEY = env('OPENAI_API_KEY', default='')
GEMINI_API_KEY = env('GEMINI_API_KEY', default='')
HUGGINGFACE_API_KEY = env('HUGGINGFACE_API_KEY', default=env('HF_TOKEN', default=''))
GROQ_API_KEY = env('GROQ_API_KEY', default='')

# -----------------------------------------------------------------------------
# Langfuse Prompt Management & Observability
# -----------------------------------------------------------------------------
USE_LOCAL_PROMPTS = env.bool('USE_LOCAL_PROMPTS', default=False)  # True = local prompts.py, False = Langfuse CMS
LANGFUSE_PUBLIC_KEY = env('LANGFUSE_PUBLIC_KEY', default='')
LANGFUSE_SECRET_KEY = env('LANGFUSE_SECRET_KEY', default='')
LANGFUSE_HOST = env('LANGFUSE_HOST', default=env('LANGFUSE_BASE_URL', default='https://cloud.langfuse.com'))
LANGFUSE_PROMPT_CACHE_TTL_SECONDS = env.int('LANGFUSE_PROMPT_CACHE_TTL_SECONDS', default=600)  # 10 minutes

# -----------------------------------------------------------------------------
# LLM Generation & Multi-Tier Cascading RAG Configuration
# -----------------------------------------------------------------------------
LLM_PROVIDER = env('LLM_PROVIDER', default='cascade')  # 'cascade' (HF -> Groq -> Gemini), 'huggingface', 'groq', 'gemini', 'openai', 'mock'
LLM_MODEL_NAME = env('LLM_MODEL_NAME', default='qwen/qwen3.8-27b')
HF_MODEL_NAME = env('HF_MODEL_NAME', default='meta-llama/Llama-3.1-8b-instruct')
GROQ_MODEL_NAME = env('GROQ_MODEL_NAME', default='qwen/qwen3.8-27b')
GEMINI_MODEL_NAME = env('GEMINI_MODEL_NAME', default='gemini-flash-lite-latest')
LLM_TEMPERATURE = env.float('LLM_TEMPERATURE', default=0.2)
LLM_MAX_TOKENS = env.int('LLM_MAX_TOKENS', default=4096)
LLM_TIMEOUT_SECONDS = env.int('LLM_TIMEOUT_SECONDS', default=45)

RAG_TOP_K = env.int('RAG_TOP_K', default=6)
RAG_MIN_SIMILARITY_SCORE = env.float('RAG_MIN_SIMILARITY_SCORE', default=0.35)
RAG_MAX_HISTORY_TURNS = env.int('RAG_MAX_HISTORY_TURNS', default=5)
RAG_MAX_CONTEXT_TOKENS = env.int('RAG_MAX_CONTEXT_TOKENS', default=4096)
RAG_MAX_MESSAGES_PER_CONVERSATION = env.int('RAG_MAX_MESSAGES_PER_CONVERSATION', default=50)

# Rate Limiting (Requests per minute)
RAG_USER_RATE_LIMIT = env.int('RAG_USER_RATE_LIMIT', default=10)
RAG_WORKSPACE_RATE_LIMIT = env.int('RAG_WORKSPACE_RATE_LIMIT', default=60)

# -----------------------------------------------------------------------------
# Frontend URL & Email Delivery Configuration
# -----------------------------------------------------------------------------
FRONTEND_URL = env('FRONTEND_URL', default='http://localhost:5173')
EMAIL_BACKEND = env('EMAIL_BACKEND', default='apps.common.email_backend.SmartEmailBackend')
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default='KnowFlow AI <noreply@knowflow.ai>')
BREVO_API_KEY = env('BREVO_API_KEY', default='')
RESEND_API_KEY = env('RESEND_API_KEY', default='')
VERIFIED_EMAIL_DOMAIN = env.bool('VERIFIED_EMAIL_DOMAIN', default=False)
EMAIL_HOST = env('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = env.int('EMAIL_PORT', default=587)
EMAIL_USE_TLS = env.bool('EMAIL_USE_TLS', default=True)
EMAIL_USE_SSL = env.bool('EMAIL_USE_SSL', default=False)
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
EMAIL_TIMEOUT = env.int('EMAIL_TIMEOUT', default=15)

