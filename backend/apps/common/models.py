"""
Common Base Models for KnowFlow AI.

Provides:
- BaseModel: Abstract base model featuring UUID primary keys and standard audit timestamps.
"""
import uuid
from django.db import models


class BaseModel(models.Model):
    """
    An abstract base class model that provides self-updating
    ``created_at`` and ``updated_at`` fields along with a universally unique
    identifier (UUID4) as the primary key.

    Why UUIDs?
    1. Security: Prevents sequential ID guessing / enumeration attacks on resources.
    2. Scalability: Allows client-side ID generation and simplifies future data sharding or distributed imports.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Universally unique identifier for this record."
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="Timestamp when the record was created."
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp when the record was last updated."
    )

    class Meta:
        abstract = True
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.__class__.__name__} ({self.id})"
