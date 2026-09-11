# 🚀 KnowFlow AI — Production Deployment Guide

This guide outlines the step-by-step procedure to deploy **KnowFlow AI** with **Render** (Backend API & Celery Worker) and **Vercel** (Frontend).

---

## 🏗️ 1. Backend & Worker Deployment (Render)

### Step 1.1: Provision Managed Services
1. **PostgreSQL Database** (Render / Neon / Supabase):
   - Create a PostgreSQL database instance.
   - Run SQL command: `CREATE EXTENSION IF NOT EXISTS vector;`
   - Copy the connection string (`DATABASE_URL`).
2. **Redis Instance** (Render / Upstash / Redis Cloud):
   - Provision a Redis instance.
   - Copy the connection URL (`REDIS_URL`).

### Step 1.2: Create Web Service (Django API)
1. In Render Dashboard, click **New + ➔ Web Service** and connect repository `udayyyy-09/knowflow-AI`.
2. Configure settings:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `./render_build.sh` (or `pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --noinput`)
   - **Start Command**: `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 3`
3. Add Environment Variables:
   - `DJANGO_SETTINGS_MODULE` = `config.settings.production`
   - `SECRET_KEY` = *(generate a secure 50-character random key)*
   - `DEBUG` = `False`
   - `DATABASE_URL` = *(your postgres connection string)*
   - `REDIS_URL` = *(your redis connection string)*
   - `ALLOWED_HOSTS` = `your-api.onrender.com,api.knowflow.ai`
   - `CORS_ALLOWED_ORIGINS` = `https://your-frontend.vercel.app,https://knowflow.ai`
   - `GEMINI_API_KEY` (or `OPENAI_API_KEY`)
   - `EMBEDDING_PROVIDER` = `gemini` (or `openai` / `local`)
   - `USE_LOCAL_PROMPTS` = `True` (or `False` with Langfuse keys)
4. Under **Settings ➔ Deploy Hook**, copy the **Deploy Hook URL**.

### Step 1.3: Create Background Worker (Celery)
1. Click **New + ➔ Background Worker** and connect the same repository.
2. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `celery -A config worker --loglevel=info --concurrency=2`
   - Same environment variables as the Web Service (`DATABASE_URL`, `REDIS_URL`, `GEMINI_API_KEY`, etc.).

---

## 🌐 2. Frontend Deployment (Vercel)

1. In Vercel Dashboard, click **Add New... ➔ Project** and import `udayyyy-09/knowflow-AI`.
2. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
3. Environment Variables:
   - `VITE_API_BASE_URL` = `https://your-api.onrender.com/api/v1`
4. Click **Deploy**.

---

## 🔐 3. GitHub Actions Continuous Deployment (CD Secrets)

The [cd.yml](file:///.github/workflows/cd.yml) workflow automatically runs pre-flight tests and triggers production deployments on pushes to `main`.

Go to **GitHub Repository ➔ Settings ➔ Secrets and variables ➔ Actions** and add:

| Secret Name | Description | Source |
| :--- | :--- | :--- |
| `RENDER_DEPLOY_HOOK_URL` | Render Web Service Deploy Hook URL | Render Dashboard ➔ Web Service ➔ Settings ➔ Deploy Hook |
| `VERCEL_TOKEN` | Vercel Personal Access Token | Vercel Account Settings ➔ Tokens |
| `VERCEL_ORG_ID` | Vercel Organization ID | Found in `.vercel/project.json` or team settings |
| `VERCEL_PROJECT_ID` | Vercel Project ID | Found in Project Settings ➔ General |

---

## 🔄 4. How the CD Pipeline Runs

```mermaid
flowchart LR
    Push([git push origin main]) --> Test[Run Pytest Suite (113 tests) & Vite Build]
    Test -->|Pass| Render[Trigger Render Deploy Hook]
    Test -->|Pass| Vercel[Deploy Frontend to Vercel via CLI]
    Render --> Summary[Generate Pipeline Summary]
    Vercel --> Summary
```
