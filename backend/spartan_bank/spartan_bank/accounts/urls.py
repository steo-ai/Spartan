# accounts/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenBlacklistView
from .views import (
    register_view,
    LoginView,
    VerifySecurityQuestionView,
    AccountViewSet,
    TransactionViewSet,
    LoanApplicationViewSet,
    ProfileViewSet,
    verify_otp_view,
    resend_otp_view,
    BiometricLoginView,
)

router = DefaultRouter()
router.register(r'accounts', AccountViewSet, basename='account')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'loans', LoanApplicationViewSet, basename='loan')
router.register(r'profiles', ProfileViewSet, basename='profile')

urlpatterns = [
    path('', include(router.urls)),

    # Function-based views
    path('register/', register_view, name='register'),
    path('verify-otp/', verify_otp_view, name='verify-otp'),
    path('resend-otp/', resend_otp_view, name='resend-otp'),

    # Class-based views
    path('login/', LoginView.as_view(), name='login'),
    path('login/verify-question/', VerifySecurityQuestionView.as_view(), name='verify-security-question'),
    path('login/biometric/', BiometricLoginView.as_view(), name='biometric-login'),

    # Removed custom path → Now handled automatically by the router via @action
    # The endpoint will be: /accounts/profiles/enable-biometric/

    path('logout/', TokenBlacklistView.as_view(), name='token_blacklist'),
]