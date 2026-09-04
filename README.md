# KnowFlow AI — Backend Architecture & API Guide

## 1. Overview

This backend is built using **Django 5.1** and **Django REST Framework (DRF)**. It provides enterprise-ready authentication, multi-tenant workspace isolation, Role-Based Access Control (RBAC), and foundation services for the KnowFlow AI Retrieval-Augmented Generation (RAG) assistant.

---

## 2. Directory Structure & File Map

```text
backend/
├── config/                         # Core Django Project Configuration
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py                 # Shared settings (DRF, JWT, Celery, Google OAuth)
│   │   ├── development.py          # Dev settings (verbose logging, relaxed CORS)
│   │   ├── production.py           # Prod settings (SSL, strict security headers)
│   │   └── test.py                 # Test settings (in-memory SQLite, fast MD5 hashers)
│   ├── celery.py                   # Celery asynchronous task application
│   ├── urls.py                     # Main routing table (/admin/, /health/, /api/v1/...)
│   ├── wsgi.py                     # WSGI gateway for production servers
│   └── asgi.py                     # ASGI gateway
│
├── apps/
│   ├── common/                     # Cross-cutting foundational utilities
│   │   ├── models.py               # BaseModel: UUIDv4 primary keys + auto timestamps
│   │   ├── exceptions.py           # custom_exception_handler: Standardized JSON error envelopes
│   │   ├── pagination.py           # StandardResultsSetPagination: Dynamic page size support
│   │   └── permissions.py          # Base permission helpers (IsSuperUser, IsOwnerOrReadOnly)
│   │
│   ├── accounts/                   # Identity, Authentication & Profiles
│   │   ├── models.py               # Custom User model (UUID, email-as-username, auth_provider)
│   │   ├── managers.py             # CustomUserManager (create_user, create_superuser)
│   │   ├── services/
│   │   │   └── google_auth.py      # Google OAuth 2.0 ID token verification & user provisioning
│   │   ├── serializers.py          # Registration, Login, Google OAuth, Profile serializers
│   │   ├── views.py                # RegisterView, LoginView, GoogleAuthView, LogoutView, Me
│   │   ├── urls.py                 # /api/v1/auth/ routes
│   │   └── admin.py                # Django Admin UserAdmin customized for email-based login
│   │
│   └── workspaces/                 # Multi-Tenant Workspaces & RBAC
│       ├── models.py               # Workspace (slug, tenant boundary), WorkspaceMembership
│       ├── permissions.py          # IsWorkspaceMember, IsWorkspaceAdmin, IsWorkspaceManagerOrAdmin
│       ├── serializers.py          # Workspace CRUD, Member Add/Update serializers
│       ├── views.py                # WorkspaceListCreate, WorkspaceDetail, Member management
│       ├── urls.py                 # /api/v1/workspaces/ routes
│       └── admin.py                # WorkspaceAdmin with tabular inline memberships
│
├── tests/                          # Automated Pytest Suite
│   ├── conftest.py                 # Shared fixtures (users, tokens, clients, workspaces)
│   ├── test_accounts.py            # Registration, Login, JWT rotation, Google OAuth, Me
│   ├── test_workspaces.py          # Workspace CRUD and Member management tests
│   └── test_rbac.py                # Strict RBAC permission rejection tests
│
├── manage.py                       # Administrative CLI entry point
├── pyproject.toml                  # Python package metadata & tool configuration
├── requirements.txt                # Locked Python dependencies
├── .env.example                    # Environment variable documentation template
└── .env                            # Local development configuration
```

---

## 3. How Each Component Works

### A. Base Architecture (`apps.common`)
- **`BaseModel`**: Every model across KnowFlow inherits from `BaseModel`. This ensures non-enumerable `UUIDv4` primary keys (`id`) and automatic UTC indexing on `created_at` and `updated_at`.
- **`custom_exception_handler`**: Unifies all API errors (validation, authentication, permission, not found) into a predictable contract:
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid input data.",
      "details": { "email": ["An account with this email already exists."] }
    }
  }
  ```
- **`StandardResultsSetPagination`**: Enables client control over page size (`?page=1&page_size=20`) with metadata fields (`count`, `total_pages`, `current_page`, `next`, `previous`, `results`).

---

### B. Accounts & Authentication (`apps.accounts`)
- **Custom `User` Model**:
  - `email` is the unique identity credential (`USERNAME_FIELD = 'email'`).
  - Supports `auth_provider`: `'email'` or `'google'`.
  - Holds `google_id` and `avatar_url` populated automatically upon Google Sign-In.
- **JWT Authentication via `djangorestframework-simplejwt`**:
  - Access Token lifetime: 30 minutes.
  - Refresh Token lifetime: 7 days.
  - Refresh token rotation & automatic blacklisting on reuse enabled.
- **Google OAuth 2.0 Sign-In via DRF**:
  - **Frontend Flow**: The React frontend uses Google Identity Services to obtain a signed JWT `id_token`.
  - **Backend Endpoint**: `POST /api/v1/auth/google/` with `{ "id_token": "<token>" }`.
  - **Verification Service (`services/google_auth.py`)**: Cryptographically validates the token against Google's public keys and checks audience (`GOOGLE_CLIENT_ID`) and issuer (`accounts.google.com`).
  - **User Provisioning**: Auto-creates new user or links `google_id` to an existing email account, then returns SimpleJWT access and refresh tokens.

---

### C. Workspaces & RBAC (`apps.workspaces`)
- **Tenant Boundary (`Workspace`)**:
  - Every document, chunk, vector embedding, and chat conversation is partitioned by a `Workspace`.
  - Workspaces feature auto-slug generation (e.g. "HR & People" -> `hr-people`).
- **Role-Based Access Control (`WorkspaceMembership`)**:
  - `ADMIN`: Full control over workspace settings, member management, documents, and chat.
  - `MANAGER`: Document upload, version management, and chat.
  - `EMPLOYEE`: Read-only queries, chat with authorized knowledge.
- **Permission Classes**:
  - `IsWorkspaceMember`: Verifies membership before granting any data access.
  - `IsWorkspaceAdmin`: Restricts sensitive operations (adding members, updating roles, workspace deletion).
  - `IsWorkspaceManagerOrAdmin`: Restricts document uploads and management.

---

## 4. API Endpoints Reference

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/v1/auth/register/` | Register with email & password | No |
| `POST` | `/api/v1/auth/login/` | Sign in with email & password | No |
| `POST` | `/api/v1/auth/google/` | Sign in / Register with Google OAuth ID token | No |
| `POST` | `/api/v1/auth/refresh/` | Refresh JWT access token | No |
| `POST` | `/api/v1/auth/logout/` | Blacklist refresh token & logout | Yes |
| `GET` | `/api/v1/auth/me/` | Get authenticated user profile | Yes |
| `PATCH` | `/api/v1/auth/me/` | Update profile (first_name, last_name) | Yes |

### Workspace Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/v1/workspaces/` | List user's workspaces | Yes |
| `POST` | `/api/v1/workspaces/` | Create workspace (creator becomes ADMIN) | Yes |
| `GET` | `/api/v1/workspaces/<id>/` | Retrieve workspace details | Member |
| `PATCH` | `/api/v1/workspaces/<id>/` | Update workspace name / description | Admin |
| `DELETE` | `/api/v1/workspaces/<id>/` | Deactivate workspace | Admin |
| `GET` | `/api/v1/workspaces/<id>/members/` | List workspace members | Member |
| `POST` | `/api/v1/workspaces/<id>/members/` | Add / Invite member by email | Admin |
| `PATCH` | `/api/v1/workspaces/<id>/members/<user_id>/` | Update member role | Admin |
| `DELETE` | `/api/v1/workspaces/<id>/members/<user_id>/` | Remove member from workspace | Admin |

### System Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health/` | Health check for DB & Redis |
| `GET` | `/admin/` | Django Administration Console |

---

## 5. Running the Test Suite

```bash
cd backend
source .venv/bin/activate
pytest --cov=apps --cov-report=term-missing
```
