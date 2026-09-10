# KnowFlow AI — Enterprise Knowledge Assistant

[![Python Version](https://img.shields.io/badge/python-3.11%2B-blue.svg)](https://www.python.org/)
[![Django](https://img.shields.io/badge/django-5.1-green.svg)](https://www.djangoproject.com/)
[![DRF](https://img.shields.io/badge/drf-3.15-red.svg)](https://www.django-rest-framework.org/)
[![pgvector](https://img.shields.io/badge/pgvector-0.3-blueviolet.svg)](https://github.com/pgvector/pgvector)
[![Celery](https://img.shields.io/badge/celery-5.4-brightgreen.svg)](https://docs.celeryq.dev/)
[![Langfuse](https://img.shields.io/badge/langfuse-4.15%2B-orange.svg)](https://langfuse.com/)
[![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)](LICENSE)

KnowFlow AI is a production-grade, multi-tenant **Enterprise Knowledge Assistant** powered by **Retrieval-Augmented Generation (RAG)**. It allows employees to interact with company policies, SOPs, engineering documentation, and operational manuals through natural-language conversation with verifiable, inline citations.

---

## 1. System Architecture

```mermaid
flowchart TD
    subgraph Client Layer
        Web[Web / Test Client UI]
        SSEStream[SSE EventSource / Stream Reader]
    end

    subgraph API & Gateway Layer
        DRF[Django REST Framework]
        Auth[SimpleJWT / Google OAuth 2.0]
        Limiter[Redis Rate Limiter & Guardrails]
    end

    subgraph Data & Vector Layer
        PG[(PostgreSQL 16 + pgvector)]
        Redis[(Redis 7: Caching & Broker)]
        Storage[(Hashed Document Storage)]
    end

    subgraph Async Processing Layer
        Celery[Celery Distributed Workers]
        Parsers[Parsers: PDF, DOCX, MD, TXT]
        Chunker[Recursive Character Chunker]
        EmbeddingFactory[Embedding Provider: FastEmbed / Gemini / OpenAI]
    end

    subgraph RAG & LLM Engine
        VectorSearch[Multi-Tenant pgvector Cosine Search]
        ContextBuilder[Token Budget Manager & XML Packaging]
        PromptManager[Prompt Manager: Langfuse CMS / prompts.py Fallback]
        LLM[LLM Engine: Gemini 3.1 Flash Lite / OpenAI]
        CitationVal[Citation Validator & Sanitizer]
    end

    Web -->|REST / SSE| DRF
    DRF --> Auth
    DRF --> Limiter
    Limiter --> Redis
    DRF --> PG

    %% Ingestion Pipeline
    DRF -->|Dispatch Task| Celery
    Celery --> Storage
    Celery --> Parsers
    Parsers --> Chunker
    Chunker --> EmbeddingFactory
    EmbeddingFactory --> PG

    %% RAG Pipeline
    DRF --> VectorSearch
    VectorSearch --> PG
    VectorSearch --> ContextBuilder
    ContextBuilder --> PromptManager
    PromptManager <-->|Fetch / Cache| Redis
    PromptManager --> LLM
    LLM --> SSEStream
    LLM --> CitationVal
    CitationVal --> PG
```

---

## 2. Directory Structure & Complete File Map

```text
KnowFlow AI/
├── backend/
│   ├── config/                         # Core Django Project Configuration
│   │   ├── settings/
│   │   │   ├── __init__.py
│   │   │   ├── base.py                 # Shared settings (DRF, JWT, Celery, Google OAuth, LLM, Langfuse)
│   │   │   ├── development.py          # Development settings (verbose logging, relaxed CORS)
│   │   │   ├── production.py           # Production settings (strict security, SSL, CDN)
│   │   │   └── test.py                 # Test settings (in-memory SQLite, mock embeddings/LLM)
│   │   ├── celery.py                   # Celery asynchronous task worker setup
│   │   ├── urls.py                     # Main URL routing table (/admin/, /health/, /api/v1/...)
│   │   ├── wsgi.py                     # WSGI production gateway
│   │   └── asgi.py                     # ASGI gateway
│   │
│   ├── apps/
│   │   ├── common/                     # Cross-Cutting Shared Utilities
│   │   │   ├── models.py               # BaseModel: Non-enumerable UUIDv4 PKs + auto timestamps
│   │   │   ├── exceptions.py           # custom_exception_handler: Uniform error JSON envelope
│   │   │   ├── pagination.py           # StandardResultsSetPagination: Dynamic page sizes
│   │   │   └── permissions.py          # Base permission helpers (IsSuperUser, IsOwnerOrReadOnly)
│   │   │
│   │   ├── accounts/                   # Identity, Authentication & Profiles
│   │   │   ├── models.py               # Custom User model (UUID, email-as-username, auth_provider)
│   │   │   ├── managers.py             # CustomUserManager (create_user, create_superuser)
│   │   │   ├── services/
│   │   │   │   └── google_auth.py      # Google OAuth 2.0 ID token cryptographic verification
│   │   │   ├── serializers.py          # Registration, Login, Google OAuth, Profile serializers
│   │   │   ├── views.py                # RegisterView, LoginView, GoogleAuthView, LogoutView, Me
│   │   │   ├── urls.py                 # /api/v1/auth/ routes
│   │   │   └── admin.py                # Email-first Django UserAdmin
│   │   │
│   │   ├── workspaces/                 # Multi-Tenant Workspaces & RBAC
│   │   │   ├── models.py               # Workspace (tenant boundary, auto-slug), WorkspaceMembership
│   │   │   ├── permissions.py          # IsWorkspaceMember, IsWorkspaceAdmin, IsWorkspaceManagerOrAdmin
│   │   │   ├── serializers.py          # Workspace CRUD, Member Add/Update serializers
│   │   │   ├── views.py                # WorkspaceListCreate, WorkspaceDetail, Member management
│   │   │   ├── urls.py                 # /api/v1/workspaces/ routes
│   │   │   └── admin.py                # Tabular inline memberships admin
│   │   │
│   │   ├── documents/                  # Document Ingestion, Parsing & Embedding Engine
│   │   │   ├── models.py               # Document, DocumentVersion, DocumentChunk, Embedding
│   │   │   ├── permissions.py          # CanManageWorkspaceDocuments
│   │   │   ├── serializers.py          # Document, Version, Chunk, Embedding, VectorSearch serializers
│   │   │   ├── views.py                # Upload, Versioning, Download, Chunks, Reprocess, Reembed, Search
│   │   │   ├── urls.py                 # /api/v1/workspaces/<id>/documents/ routes
│   │   │   ├── tasks.py                # Celery tasks: process_document_version, reembed_document_version
│   │   │   ├── services/
│   │   │   │   ├── storage.py          # SHA-256 deduplication & multi-tenant hashed disk storage
│   │   │   │   ├── ingestion.py        # DocumentIngestionService: Async orchestration
│   │   │   │   ├── embedding_service.py# Batch vector generation & persistence
│   │   │   │   └── vector_search.py    # Multi-tenant pgvector HNSW cosine similarity search
│   │   │   └── pipeline/
│   │   │       ├── parsers/            # PDFParser, DOCXParser, MarkdownParser, TextParser, Factory
│   │   │       ├── chunkers/           # RecursiveCharacterChunker (chunk size, overlap & headers)
│   │   │       └── embeddings/         # BaseEmbeddingProvider, FastEmbed (ONNX), Gemini, OpenAI, Factory
│   │   │
│   │   └── chat/                       # RAG Orchestration, Langfuse & Streaming Chat
│   │       ├── models.py               # Conversation, Message, MessageSource (Citations)
│   │       ├── prompts.py              # Single static fallback prompt definitions (system + user)
│   │       ├── permissions.py          # IsWorkspaceMemberForChat, IsConversationOwnerOrAdmin
│   │       ├── serializers.py          # Conversation, Message, MessageSource, SendMessage serializers
│   │       ├── views.py                # WorkspaceConversationListCreate, ConversationDetail, SendMessageView
│   │       ├── urls.py                 # /api/v1/workspaces/<id>/conversations/, /api/v1/conversations/
│   │       ├── services/
│   │       │   ├── prompt_manager.py   # Langfuse Prompt CMS integration + TTL cache + fallback
│   │       │   ├── context_builder.py  # Token budgeting, XML packaging & conversation windowing
│   │       │   ├── citation_validator.py # Out-of-bounds dropping, XML tag cleansing & source matching
│   │       │   ├── rate_limiter.py     # Redis token bucket rate limiting & conversation capacity guards
│   │       │   └── rag_service.py      # Master RAG turn orchestrator (sync & SSE streaming)
│   │       ├── pipeline/
│   │       │   └── llm/                # BaseLLMProvider, Gemini (3.1 Flash Lite), OpenAI, Mock, Factory
│   │       └── admin.py                # Chat Conversation, Message, and Citation Source admin
│   │
│   ├── scripts/                        # Operational Benchmarks & Utilities
│   │   ├── profile_memory.py           # RSS memory profiler (Render 512MB RAM validation)
│   │   ├── compare_embeddings.py       # Head-to-head retrieval benchmark (FastEmbed vs Gemini)
│   │   └── precache_model.py           # Docker/build pre-caching for FastEmbed ONNX weights
│   │
│   ├── templates/
│   │   └── test_client.html            # Built-in Interactive Web Playground UI
│   │
│   ├── tests/                          # Pytest Automated Test Suite (98/98 Tests Passing)
│   │   ├── conftest.py                 # Shared fixtures (users, tokens, clients, workspaces, docs)
│   │   ├── test_accounts.py            # Registration, Login, JWT rotation, Google OAuth, Me
│   │   ├── test_workspaces.py          # Workspace CRUD and Member management tests
│   │   ├── test_rbac.py                # Strict RBAC permission rejection tests
│   │   ├── test_documents.py           # Document upload, versioning, download, archive tests
│   │   ├── test_processing_pipeline.py # Parsers, chunker, Celery task, chunks API tests
│   │   ├── test_embeddings.py          # Embedding providers, vector search, permissions tests
│   │   └── test_chat.py                # Langfuse prompt manager, token budget, citations, SSE stream, rate limiter
│   │
│   ├── manage.py                       # Django administrative CLI
│   ├── pyproject.toml                  # Python package metadata & dependencies
│   ├── .env.example                    # Template for environment configuration
│   └── .env                            # Local configuration (API keys, DB, Redis)
│
├── sample_documents/                   # Sample enterprise policy documents (.md, .docx, .pdf)
├── docker-compose.yml                  # PostgreSQL (pgvector) & Redis service containers
├── KnowFlow_AI_Architecture_Documentation.md # Full architecture specification
└── README.md                           # This document
```

---

## 3. Core Architectural Pillars

### A. Authentication, Identity & Multi-Tenant RBAC
- **Custom User Model**: Primary identifier is `email`, backed by non-enumerable `UUIDv4` primary keys.
- **JWT Authentication (`SimpleJWT`)**: 30-minute access tokens with 7-day refresh tokens. Automatic token rotation and reuse blacklisting.
- **Google OAuth 2.0**: Direct verification of Google `id_token` via Google's public cryptographic keys (`POST /api/v1/auth/google/`).
- **Multi-Tenant Workspaces**: Every document, chunk, vector embedding, and chat conversation is isolated within a `Workspace`.
- **Role Hierarchy**:
  - `ADMIN`: Full administrative control (workspace settings, user invitations, role changes, document deletion).
  - `MANAGER`: Document upload, re-chunking, re-embedding, and chat.
  - `EMPLOYEE`: Read-only access to authorized documents and RAG chat.

---

### B. Ingestion, Parsing & Chunking Pipeline
- **Multi-Format Extraction**: Dedicated parsers for PDF (`pypdf`), DOCX (`python-docx`), Markdown, and Plain Text.
- **Recursive Character Chunking**: Breaks text into structured chunks based on natural paragraph and sentence boundaries, preserving section headers, page numbers, character counts, and token estimates.
- **Deduplication & Storage**: Content hashed via SHA-256 to prevent duplicate processing. Stored on disk in tenant-isolated directory structures.
- **Asynchronous Execution**: Document parsing and chunking are offloaded to background Celery workers, tracking status transitions (`PENDING` $\rightarrow$ `PROCESSING` $\rightarrow$ `COMPLETED` / `FAILED`).

---

### C. Vector Embeddings & pgvector Semantic Search
- **Embedding Provider Abstraction**:
  - **`local` / `fastembed`**: `BAAI/bge-small-en-v1.5` (~90MB ONNX Runtime model, 384 dimensions). Consumes only **281MB steady-state RAM** (zero OOM risk on Render 512MB free tier), with **22–28ms local latency** and zero API costs.
  - **`gemini`**: Google `gemini-embedding-001` (1536 dimensions).
  - **`openai`**: OpenAI `text-embedding-3-small` (1536 dimensions).
  - **`mock`**: Deterministic mock provider for offline continuous integration.
- **HNSW Cosine Vector Index**: Leverages PostgreSQL `pgvector` with HNSW cosine distance indexing (`<=>`) scoped strictly to `workspace_id`.

---

### D. Production RAG Engine & Langfuse Prompt Management
- **Langfuse Prompt CMS Integration**:
  - **Primary**: Dynamic prompt template fetching from Langfuse (`rag-pipeline-prompt`, `rag-system-prompt`, `rag-user-prompt`) with `label="production"`.
  - **Infallible Fallback**: If Langfuse credentials are unset, network times out, or the API is unavailable, the engine seamlessly falls back to [`backend/apps/chat/prompts.py`](file:///Users/udaychaudhary/Desktop/KnowFlow%20AI/backend/apps/chat/prompts.py) with zero downtime.
  - **TTL Caching**: Redis-backed caching (`LANGFUSE_PROMPT_CACHE_TTL_SECONDS=600`) eliminates per-request API roundtrips.
- **Context Builder & Token Budget Manager**:
  - Enforces strict context budget caps (`RAG_MAX_CONTEXT_TOKENS=3072`).
  - Dynamically evicts lowest-scoring chunks when capacity is reached.
  - Retains recent conversation history turns (`RAG_MAX_HISTORY_TURNS=5`).
- **Indirect Prompt Injection Defense**:
  - Encapsulates retrieved chunks inside strict `<context><source index="N" ...><![CDATA[...]]></source></context>` boundaries.
  - System instructions explicitly instruct the model to treat context as inert data and ignore injected override directives.
- **Strict Citation Validation**:
  - Extracts inline bracket citations (`[1]`, `[2]`).
  - Drops hallucinated out-of-bounds indices (e.g., model citing `[9]` when only 3 sources exist).
  - Cleanses accidental XML tags or CDATA leaks.
  - Automatically persists verified references to [`MessageSource`](file:///Users/udaychaudhary/Desktop/KnowFlow%20AI/backend/apps/chat/models.py) database records.
- **Real-Time Server-Sent Events (SSE) Streaming**:
  - `POST /api/v1/conversations/<id>/messages/?stream=true` streams token deltas word-by-word with `ServerSentEventsRenderer`.
  - Emits structured events: `metadata`, `token`, `citations`, and `done`.
- **LLM Engine**:
  - Powered by **Google Gemini 3.1 Flash Lite** (`gemini-3.1-flash-lite`), generating full multi-point grounded answers with citations in **~2.5 seconds**.
- **Rate Limiting & Cost Guardrails**:
  - Redis sliding window limiter enforcing **10 requests/minute per user** and **60 requests/minute per workspace**.
  - Caps conversation threads to **50 messages max** to avoid cost runaway.

---

## 4. API Endpoints Reference

### A. Authentication (`/api/v1/auth/`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/v1/auth/register/` | Register with email & password | No |
| `POST` | `/api/v1/auth/login/` | Sign in with email & password | No |
| `POST` | `/api/v1/auth/google/` | Sign in / Register with Google OAuth ID token | No |
| `POST` | `/api/v1/auth/refresh/` | Refresh JWT access token | No |
| `POST` | `/api/v1/auth/logout/` | Blacklist refresh token & logout | Yes |
| `GET` | `/api/v1/auth/me/` | Get authenticated user profile | Yes |
| `PATCH` | `/api/v1/auth/me/` | Update profile (first_name, last_name) | Yes |

---

### B. Workspaces & Members (`/api/v1/workspaces/`)

| Method | Endpoint | Description | Auth / Role Required |
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

---

### C. Document Management & Ingestion (`/api/v1/workspaces/<ws_id>/documents/`)

| Method | Endpoint | Description | Auth / Role Required |
|---|---|---|---|
| `GET` | `/api/v1/workspaces/<ws_id>/documents/` | List documents (supports `status`, `file_type`, `search`) | Member |
| `POST` | `/api/v1/workspaces/<ws_id>/documents/` | Upload document (`.pdf`, `.docx`, `.txt`, `.md`) | Admin / Manager |
| `GET` | `/api/v1/workspaces/<ws_id>/documents/<doc_id>/` | Get document details & version history | Member |
| `PATCH` | `/api/v1/workspaces/<ws_id>/documents/<doc_id>/` | Update document title or description | Admin / Manager |
| `DELETE` | `/api/v1/workspaces/<ws_id>/documents/<doc_id>/` | Soft-delete / Archive document | Admin / Manager |
| `GET` | `/api/v1/workspaces/<ws_id>/documents/<doc_id>/versions/` | List all historical versions | Member |
| `POST` | `/api/v1/workspaces/<ws_id>/documents/<doc_id>/versions/` | Upload a new version (v2, v3...) | Admin / Manager |
| `GET` | `/api/v1/workspaces/<ws_id>/documents/<doc_id>/download/` | Secure streaming file download | Member |
| `GET` | `/api/v1/workspaces/<ws_id>/documents/<doc_id>/chunks/` | Inspect extracted text chunks and tokens | Member |
| `POST` | `/api/v1/workspaces/<ws_id>/documents/<doc_id>/reprocess/` | Re-trigger parsing & chunking pipeline | Admin / Manager |
| `POST` | `/api/v1/workspaces/<ws_id>/documents/<doc_id>/reembed/` | Re-calculate embeddings for document chunks | Admin / Manager |

---

### D. Vector Similarity Search (`/api/v1/workspaces/<ws_id>/search/`)

| Method | Endpoint | Description | Auth / Role Required |
|---|---|---|---|
| `POST` | `/api/v1/workspaces/<ws_id>/search/` | Semantic similarity search via pgvector cosine distance | Member |

---

### E. RAG Chat & Real-Time Streaming (`/api/v1/conversations/`)

| Method | Endpoint | Description | Auth / Role Required |
|---|---|---|---|
| `GET` | `/api/v1/workspaces/<ws_id>/conversations/` | List conversation threads in workspace | Member |
| `POST` | `/api/v1/workspaces/<ws_id>/conversations/` | Start a new conversation thread | Member |
| `GET` | `/api/v1/conversations/<conv_id>/` | Retrieve conversation thread history & messages | Owner / Admin |
| `DELETE` | `/api/v1/conversations/<conv_id>/` | Soft-delete conversation thread | Owner / Admin |
| `POST` | `/api/v1/conversations/<conv_id>/messages/` | Send message (Sync JSON or `?stream=true` for SSE) | Owner / Admin |

---

### F. System & Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health/` | Liveness & readiness check for DB and Redis |
| `GET` | `/admin/` | Django Administration Console |

---

## 5. Getting Started (Local Development)

### Prerequisites
- **Python 3.11+**
- **Docker & Docker Compose** (for PostgreSQL + pgvector and Redis)
- **Node.js 18+** (for frontend development / Langfuse CLI)

---

### Step 1: Clone and Start Infrastructure Services

```bash
# Clone the repository
git clone https://github.com/udayyyy-09/knowflow-AI.git
cd knowflow-AI

# Start PostgreSQL (pgvector) and Redis via Docker Compose
docker-compose up -d
```

Verify containers are running:
```bash
docker ps
# Expected: knowflow_postgres (port 5432) and knowflow_redis (port 6379)
```

---

### Step 2: Virtual Environment & Dependencies

```bash
cd backend

# Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

### Step 3: Configure Environment Variables

Create your local `.env` file from the template:

```bash
cp .env.example .env
```

Key environment variables in `backend/.env`:

```env
DEBUG=True
SECRET_KEY=your-development-secret-key
ALLOWED_HOSTS=127.0.0.1,localhost

# Database (PostgreSQL with pgvector)
DATABASE_URL=postgresql://knowflow_user:knowflow_pass@127.0.0.1:5432/knowflow_db

# Redis & Celery
REDIS_URL=redis://127.0.0.1:6379/0
CELERY_BROKER_URL=redis://127.0.0.1:6379/0

# Embedding Provider ('gemini' for 1536d, 'local' / 'fastembed' for 384d)
EMBEDDING_PROVIDER=gemini
EMBEDDING_DIMENSIONS=1536
GEMINI_API_KEY=your-gemini-api-key

# LLM Generation ('gemini', 'openai', 'mock')
LLM_PROVIDER=gemini
LLM_MODEL_NAME=gemini-3.1-flash-lite
LLM_TEMPERATURE=0.2
LLM_MAX_TOKENS=1024
LLM_TIMEOUT_SECONDS=45

# Langfuse Prompt Management (Optional - automatic fallback to prompts.py if empty)
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com
LANGFUSE_PROMPT_CACHE_TTL_SECONDS=600
```

---

### Step 4: Run Migrations & Create Superuser

```bash
# Apply database schema migrations
python manage.py migrate

# Create admin user
python manage.py createsuperuser
```

---

### Step 5: Start Celery Worker & Django Server

In Terminal 1 (Celery background worker):
```bash
cd backend
source .venv/bin/activate
celery -A config worker --loglevel=info
```

In Terminal 2 (Django development server):
```bash
cd backend
source .venv/bin/activate
python manage.py runserver
```

---

## 6. Interactive Web Playground UI

KnowFlow AI includes a built-in single-page interactive client ([`backend/templates/test_client.html`](file:///Users/udaychaudhary/Desktop/KnowFlow%20AI/backend/templates/test_client.html)) for rapid end-to-end testing:

1. Open your browser and navigate to:
   ```text
   http://127.0.0.1:8000/
   ```
2. **What you can test in the Playground**:
   - **Authentication**: Register with email/password or log in via Google One-Tap.
   - **Workspace Switcher**: Create new workspaces and invite members.
   - **Document Hub**: Drag & drop files (`.pdf`, `.docx`, `.txt`, `.md`), watch live Celery ingestion status, and inspect chunk text with token counts.
   - **Real-Time Streaming Chat**: Ask policy questions, watch token-by-token SSE streaming, and click citation chips (`[1]`, `[2]`) to open the source excerpt modal with similarity scores and page numbers.

---

## 7. Vector Dimension Management Guide

PostgreSQL `documents_embedding` table column `vector` is typed with fixed dimensions matching your active provider:

| Provider | Model Name | Dimensionality | Best For |
| :--- | :--- | :---: | :--- |
| **`local` / `fastembed`** | `BAAI/bge-small-en-v1.5` | **384** | Render Free Tier (512MB RAM cap), 0 API costs, 22ms latency |
| **`gemini`** | `gemini-embedding-001` | **1536** | Cloud scale, Google Cloud AI ecosystem |
| **`openai`** | `text-embedding-3-small` | **1536** | OpenAI GPT integration |

### Switching Between Gemini (1536d) and FastEmbed (384d)

If you switch `EMBEDDING_PROVIDER` in `.env`:

1. Run the custom dimension migration command:
   ```bash
   python manage.py set_vector_dimension --dimension 384
   # Or for Gemini:
   python manage.py set_vector_dimension --dimension 1536
   ```
2. Re-embed existing document versions:
   ```bash
   # Or trigger via POST /api/v1/workspaces/<id>/documents/<doc_id>/reembed/
   ```

---

## 8. Automated Test Suite & Quality Assurance

KnowFlow AI maintains an end-to-end test suite covering models, serializers, services, RBAC authorization, Celery ingestion tasks, vector similarity search, Langfuse prompt management, and SSE streaming.

Run tests with code coverage:

```bash
cd backend
source .venv/bin/activate
pytest --cov=apps --cov-report=term-missing
```

### Test Suite Summary:
```text
============================== 98 passed in 1.60s ==============================
- tests/test_accounts.py ............... (15 Passed)
- tests/test_workspaces.py ...........   (11 Passed)
- tests/test_rbac.py .........           (9 Passed)
- tests/test_documents.py .........      (9 Passed)
- tests/test_processing_pipeline.py .... (13 Passed)
- tests/test_embeddings.py ............. (26 Passed)
- tests/test_chat.py ................... (15 Passed)
Total Coverage: >85% across all core apps.
```

---

## 9. License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
