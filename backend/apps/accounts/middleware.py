"""
Custom Middleware for KnowFlow Accounts.
"""

class AuthSourceHeaderMiddleware:
    """
    Attaches an X-Auth-Source header to HTTP responses to inform the client
    whether the request was authenticated via 'cookie' or 'header' (Bearer token).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        auth_source = getattr(request, 'auth_source', None)
        if auth_source:
            response['X-Auth-Source'] = auth_source
        return response
