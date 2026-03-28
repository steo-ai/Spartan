# accounts/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    register_view,                 # ← add this
    LoginView,
    VerifySecurityQuestionView,
    AccountViewSet,
    TransactionViewSet,
    LoanApplicationViewSet,
    ProfileViewSet,
    verify_otp_view,
    resend_otp_view,
    
)

router = DefaultRouter()
router.register(r'accounts', AccountViewSet, basename='account')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'loans', LoanApplicationViewSet, basename='loan')
router.register(r'profiles', ProfileViewSet, basename='profile')


urlpatterns = [
    path('', include(router.urls)),
    path('register/', register_view, name='register'),          # ← now function-based
    path('login/', LoginView.as_view(), name='login'),
    path('login/verify-question/', VerifySecurityQuestionView.as_view(), name='verify-security-question'),
    path('verify-otp/', verify_otp_view, name='verify-otp'),
    path('resend-otp/', resend_otp_view, name='resend-otp'),
]