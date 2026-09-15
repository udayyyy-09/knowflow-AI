# KnowFlow Core — Technical Architecture & Microservices Specification (2026)
**Document Code:** SPEC-ENG-2026-v4  
**Project:** KnowFlow AI Distributed RAG Engine  
**Classification:** Internal Engineering — Core Platform Team  
**Author:** Principal Platform Architect  
**Status:** Approved for Production Deployment  

---

## 1. System Overview & Engineering Objectives
KnowFlow AI is a high-throughput, multi-tenant Retrieval-Augmented Generation (RAG) platform. The system is designed to provide low-latency semantic search and contextual answers across millions of enterprise documents with sub-200ms Time-To-First-Token (TTFT).

### Key Architectural SLOs:
- **P95 Retrieval Latency:** < 45ms across 1,000,000+ vector records.
- **P99 Streaming TTFT:** < 350ms using multi-tier cascading LLM inference.
- **Multi-Tenant Isolation:** Cryptographic workspace partitioning enforced at database, cache, and vector query layers.
- **System Availability:** 99.95% uptime SLA with active-passive region failover.

---

## 2. Microservices Topology & Ingestion Pipeline
The platform separates asynchronous batch processing from synchronous interactive chat queries:

```
[Client App] ──► [Traefik API Gateway] ──► [Django ASGI Backend]
                                               │
                                               ├──► [PostgreSQL 16 + pgvector]
                                               ├──► [Redis 7 (Cluster & Cache)]
                                               └──► [Celery Worker Fleet]
                                                         │
                                                         ├──► Ingestion (Unstructured / PyMuPDF)
                                                         ├──► Chunking (500 tokens, 100 overlap)
                                                         └──► Embedding (Google / Hugging Face)
```

### Ingestion Stages:
1. **Upload & SHA-256 Deduplication:** Validates MIME headers and calculates checksum to prevent duplicate storage.
2. **Deterministic Chunking:** Employs recursive token-boundary chunking with semantic heading preservation (`#`, `##`, `###`).
3. **Vectorization:** Dense vector embeddings (768-dim) are generated and persisted into PostgreSQL with HNSW cosine distance indices (`m=16`, `ef_construction=64`).

---

## 3. Database Sharding & Vector Indexing Strategy
- **Primary Relational Store:** PostgreSQL 16 on managed RDS / Neon with WAL archiving.
- **Vector Index Structure:** Native `pgvector` HNSW indexes partition queries using workspace tenant IDs (`workspace_id = :tenant_uuid`).
- **Connection Pooling:** PgBouncer in transaction-pooling mode manages up to 5,000 concurrent client connections with 20 backend pool slots.

---

## 4. Multi-Tier LLM Cascading & Failover Protocol
To guarantee 100% answer availability against third-party rate limits and outages, the LLM executor uses an automatic cascading fallback:
- **Tier 1 (Primary):** Groq Cloud (`qwen/qwen3.8-27b`, `groq/compound-mini`) with sub-200ms latency.
- **Tier 2 (Secondary):** Google Gemini (`gemini-flash-lite-latest`, `gemini-flash-latest`) for deep contextual reasoning.
- **Tier 3 (Tertiary):** Hugging Face Serverless Inference (`meta-llama/Llama-3.1-8b-instruct`).

Failover triggers automatically on `429 (Rate Limit)`, `503 (High Demand)`, or `Read Timeout > 25s` before token delivery.

---

## 5. Security, RBAC & OWASP Compliance
- **Workspace Access Matrix:**
  - `ADMIN`: Full CRUD on workspace, document uploads, member invitations, role management, and deletion.
  - `MANAGER`: Document ingestion, re-indexing, and team collaboration.
  - `EMPLOYEE`: Chat queries, citation inspection, and read-only access.
- **Cryptographic Team Invites:** 32-byte cryptographically secure random tokens (`secrets.token_urlsafe(32)`) hashed with SHA-256 before database storage.
- **Prompt Injection Defense:** Strict XML boundary wrapping (`<context>` tags) prevents uploaded malicious files from overriding system instructions.

---

## 6. Monitoring & Distributed Tracing
- **Tracing & Observability:** Langfuse Distributed Tracing tracks prompt tokens, generation latency, and citation accuracy.
- **Health Verification:** Global `/health/` endpoint evaluates PostgreSQL connection readiness and Redis ping latency every 10 seconds.
