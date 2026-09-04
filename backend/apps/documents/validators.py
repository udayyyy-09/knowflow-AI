"""
File & Document Validators for KnowFlow AI.
"""
import os
from rest_framework.exceptions import ValidationError

ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.txt', '.md', '.csv'}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


def validate_document_file(file_obj):
    """
    Validate uploaded document extension and file size.
    """
    if not file_obj:
        raise ValidationError("No file was uploaded.")

    # 1. Size Validation
    if file_obj.size > MAX_FILE_SIZE_BYTES:
        max_mb = MAX_FILE_SIZE_BYTES / (1024 * 1024)
        raise ValidationError(f"File size exceeds maximum allowed limit of {max_mb:.0f} MB.")

    if file_obj.size == 0:
        raise ValidationError("Uploaded file is empty (0 bytes).")

    # 2. Extension Validation
    ext = os.path.splitext(file_obj.name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed_str = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise ValidationError(
            f"Unsupported file format '{ext}'. Allowed formats are: {allowed_str}"
        )

    return True
