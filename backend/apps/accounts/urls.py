"""
Accounts & Authentication URL Patterns.
"""
from django.urls import path
from apps.accounts.views import (
    RegisterView,
    LoginView,
    GoogleAuthView,
    CustomTokenRefreshView,
    LogoutView,
    UserProfileView,
)

app_name = 'accounts'

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('google/', GoogleAuthView.as_view(), name='google-login'),
    path('refresh/', CustomTokenRefreshView.as_view(), name='token-refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', UserProfileView.as_view(), name='me'),
]
