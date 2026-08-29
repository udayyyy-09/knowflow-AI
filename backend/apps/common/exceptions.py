"""
Standardized API Exception Handling for KnowFlow AI.

Formats all DRF exceptions into a consistent JSON response contract:
{
    "success": false,
    "error": {
        "code": "ERROR_CODE",
        "message": "Human-readable error summary",
        "details": { ... }
    }
}
"""
import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import (
    APIException,
    ValidationError,
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied,
    NotFound,
    MethodNotAllowed,
    Throttled,
)

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler for Django REST Framework.
    Wraps standard DRF error responses into a consistent contract.
    """
    # Call REST framework's default exception handler first to get the standard response.
    response = exception_handler(exc, context)

    # If an unhandled exception occurred (e.g., 500 Server Error)
    if response is None:
        view_name = context.get('view').__class__.__name__ if context.get('view') else 'UnknownView'
        logger.exception(f"Unhandled Exception in view {view_name}: {exc}", exc_info=exc)
        return Response(
            {
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected server error occurred. Please try again later.",
                    "details": str(exc) if hasattr(context.get('request'), 'debug') else None,
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # Map standard DRF exception types to clean machine-readable error codes
    error_code = "API_ERROR"
    if isinstance(exc, ValidationError):
        error_code = "VALIDATION_ERROR"
    elif isinstance(exc, (AuthenticationFailed, NotAuthenticated)):
        error_code = "AUTHENTICATION_FAILED"
    elif isinstance(exc, PermissionDenied):
        error_code = "PERMISSION_DENIED"
    elif isinstance(exc, NotFound):
        error_code = "NOT_FOUND"
    elif isinstance(exc, MethodNotAllowed):
        error_code = "METHOD_NOT_ALLOWED"
    elif isinstance(exc, Throttled):
        error_code = "RATE_LIMIT_EXCEEDED"

    # Extract primary message and detailed field errors
    details = response.data
    message = "An error occurred while processing your request."

    if isinstance(details, dict):
        if 'detail' in details:
            message = str(details.pop('detail'))
        elif len(details) == 1 and isinstance(list(details.values())[0], list):
            first_field = list(details.keys())[0]
            message = f"{first_field}: {details[first_field][0]}"
        elif len(details) > 0:
            message = "Validation failed. Please check the supplied fields."
    elif isinstance(details, list):
        if len(details) > 0:
            message = str(details[0])

    response.data = {
        "success": False,
        "error": {
            "code": error_code,
            "message": message,
            "details": details if details else None,
        }
    }

    return response
