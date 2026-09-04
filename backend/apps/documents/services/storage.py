"""
Storage & Hash Services for Document Management.
"""
import hashlib
import os
import uuid


def calculate_file_sha256(file_obj) -> str:
    """
    Calculate the SHA-256 hash of a Django UploadedFile or file-like object.
    Safely resets the file pointer to the beginning after reading.
    """
    sha256_hash = hashlib.sha256()
    file_obj.seek(0)
    for chunk in file_obj.chunks(chunk_size=65536):
        sha256_hash.update(chunk)
    file_obj.seek(0)
    return sha256_hash.hexdigest()


def document_upload_path(instance, filename: str) -> str:
    """
    Generates a secure, multi-tenant isolated file upload path:
    workspaces/<workspace_id>/documents/<document_id>/v<version_number>/<filename>
    """
    workspace_id = instance.document.workspace_id
    document_id = instance.document_id
    version_num = instance.version_number or 1

    # Sanitize filename
    clean_filename = os.path.basename(filename)
    return f"workspaces/{workspace_id}/documents/{document_id}/v{version_num}/{clean_filename}"
