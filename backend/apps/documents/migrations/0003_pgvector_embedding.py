import django.db.models.deletion
import uuid
from django.db import migrations, models
import pgvector.django
import apps.documents.models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0002_documentchunk'),
        ('workspaces', '0001_initial'),
    ]

    operations = [
        pgvector.django.VectorExtension(),
        migrations.CreateModel(
            name='Embedding',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, help_text='Universally unique identifier for this record.', primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, help_text='Timestamp when the record was created.')),
                ('updated_at', models.DateTimeField(auto_now=True, help_text='Timestamp when the record was last updated.')),
                ('vector', pgvector.django.VectorField(dimensions=1536, help_text='Dense float vector representation.')),
                ('model_name', models.CharField(default='text-embedding-3-small', help_text='Embedding model used (e.g. text-embedding-3-small, text-embedding-004).', max_length=100, verbose_name='model name')),
                ('dimensions', models.PositiveIntegerField(default=1536, help_text='Vector dimensionality.', verbose_name='dimensions')),
                ('is_active', models.BooleanField(default=True, help_text='Whether this embedding is active and searchable in RAG.', verbose_name='is active')),
                ('chunk', models.OneToOneField(help_text='The document chunk this vector embedding represents.', on_delete=django.db.models.deletion.CASCADE, related_name='embedding', to='documents.documentchunk')),
                ('document', models.ForeignKey(help_text='Denormalized document reference for cascading and fast queries.', on_delete=django.db.models.deletion.CASCADE, related_name='embeddings', to='documents.document')),
                ('workspace', models.ForeignKey(help_text='Denormalized workspace reference for multi-tenant isolation.', on_delete=django.db.models.deletion.CASCADE, related_name='embeddings', to='workspaces.workspace')),
            ],
            options={
                'verbose_name': 'embedding',
                'verbose_name_plural': 'embeddings',
                'indexes': [
                    models.Index(fields=['workspace', 'is_active'], name='documents_e_workspa_b1a329_idx'),
                    models.Index(fields=['document', 'is_active'], name='documents_e_documen_459a0f_idx'),
                    apps.documents.models.HnswIndex(ef_construction=64, fields=['vector'], m=16, name='embedding_vector_hnsw_idx', opclasses=['vector_cosine_ops']),
                ],
            },
        ),
    ]
