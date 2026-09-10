"""
Django Management Command: sync_vector_dimensions

Synchronizes the PostgreSQL pgvector column dimension with the currently configured
EMBEDDING_DIMENSIONS in settings / .env.

Usage:
    python manage.py sync_vector_dimensions
    python manage.py sync_vector_dimensions --dimensions 384
    python manage.py sync_vector_dimensions --dimensions 1536 --no-reembed
"""
import re
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from django.db import connection
from apps.documents.models import DocumentVersion, Embedding
from apps.documents.tasks import reembed_document_version


class Command(BaseCommand):
    help = "Synchronizes PostgreSQL pgvector column dimension with active settings and re-indexes documents."

    def add_arguments(self, parser):
        parser.add_argument(
            "-d", "--dimensions",
            type=int,
            default=None,
            help="Target vector dimension (defaults to settings.EMBEDDING_DIMENSIONS, e.g. 384 or 1536)."
        )
        parser.add_argument(
            "--no-reembed",
            action="store_true",
            default=False,
            help="Do not trigger background Celery tasks to re-embed documents after column change."
        )
        parser.add_argument(
            "--force",
            action="store_true",
            default=False,
            help="Skip confirmation prompt when clearing incompatible embeddings."
        )

    def handle(self, *args, **options):
        target_dim = options["dimensions"] or getattr(settings, "EMBEDDING_DIMENSIONS", 1536)
        provider = getattr(settings, "EMBEDDING_PROVIDER", "openai")
        model_name = getattr(settings, "EMBEDDING_MODEL_NAME", "text-embedding-3-small")
        no_reembed = options["no_reembed"]
        force = options["force"]

        self.stdout.write(self.style.MIGRATE_HEADING("=" * 65))
        self.stdout.write(self.style.MIGRATE_HEADING("   KNOWFLOW AI — VECTOR DIMENSION SYNCHRONIZER"))
        self.stdout.write(self.style.MIGRATE_HEADING("=" * 65))
        self.stdout.write(f"[*] Target Dimension: {target_dim}")
        self.stdout.write(f"[*] Active Provider:  {provider} ({model_name})")

        if connection.vendor != "postgresql":
            self.stdout.write(self.style.WARNING("Non-PostgreSQL database detected. Skipping pgvector DDL operations."))
            return

        with connection.cursor() as cursor:
            # Query the actual pgvector column definition
            cursor.execute("""
                SELECT format_type(atttypid, atttypmod)
                FROM pg_attribute
                WHERE attrelid = 'documents_embedding'::regclass
                  AND attname = 'vector';
            """)
            row = cursor.fetchone()

            if not row:
                raise CommandError("Table 'documents_embedding' or column 'vector' was not found. Please run 'python manage.py migrate' first.")

            current_type = row[0]
            self.stdout.write(f"[*] Current DB Column: {current_type}")

            match = re.search(r"vector\((\d+)\)", current_type)
            current_dim = int(match.group(1)) if match else None

            if current_dim == target_dim:
                self.stdout.write(self.style.SUCCESS(f"\n[OK] Database column is already vector({target_dim}). Schema is in sync!"))
                return

            self.stdout.write(self.style.WARNING(
                f"\n[!] Dimension Mismatch Detected: Current={current_dim}d, Target={target_dim}d"
            ))
            self.stdout.write("    Note: Vectors cannot be mathematically cast across different dimensions.")
            self.stdout.write("    Existing embeddings will be cleared and re-embedded.")

            if not force:
                confirm = input("    Proceed with altering vector column and clearing old embeddings? [y/N]: ")
                if confirm.lower() not in ["y", "yes"]:
                    self.stdout.write(self.style.NOTICE("Aborted by user. No changes made."))
                    return

            self.stdout.write("[*] Dropping HNSW index...")
            cursor.execute("DROP INDEX IF EXISTS embedding_vector_hnsw_idx;")

            self.stdout.write("[*] Clearing incompatible old embeddings...")
            cursor.execute("DELETE FROM documents_embedding;")

            self.stdout.write(f"[*] Altering column to vector({target_dim})...")
            cursor.execute(f"ALTER TABLE documents_embedding ALTER COLUMN vector TYPE vector({target_dim});")

            self.stdout.write("[*] Recreating HNSW cosine distance index...")
            cursor.execute(f"""
                CREATE INDEX embedding_vector_hnsw_idx 
                ON documents_embedding 
                USING hnsw (vector vector_cosine_ops) 
                WITH (m = 16, ef_construction = 64);
            """)

        self.stdout.write(self.style.SUCCESS(f"\n[SUCCESS] Column 'vector' successfully updated to vector({target_dim})!"))

        if not no_reembed:
            versions = DocumentVersion.objects.filter(is_active=True, chunks__isnull=False).distinct()
            count = versions.count()
            if count > 0:
                self.stdout.write(f"[*] Dispatching background re-embedding tasks for {count} active document version(s)...")
                for version in versions:
                    reembed_document_version.delay(str(version.id))
                self.stdout.write(self.style.SUCCESS(f"[SUCCESS] Dispatched {count} Celery re-embedding task(s)."))
            else:
                self.stdout.write("[*] No active document versions with chunks found to re-embed.")
