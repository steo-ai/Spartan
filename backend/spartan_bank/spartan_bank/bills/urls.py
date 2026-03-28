# bills/urls.py
from rest_framework.routers import DefaultRouter

from .views import (
    BillCategoryViewSet,
    BillPaymentViewSet,
    AirtimeProviderViewSet,
    DataBundleViewSet,
)

router = DefaultRouter()

# Register ViewSets with clean, consistent basenames
router.register(r'categories', BillCategoryViewSet, basename='bill-category')
router.register(r'payments', BillPaymentViewSet, basename='bill-payment')
router.register(r'providers', AirtimeProviderViewSet, basename='airtime-provider')
router.register(r'bundles', DataBundleViewSet, basename='data-bundle')

# Optional: You can also expose the custom actions directly if needed
# But router already handles /pay/ and /topup_airtime/ from the ViewSet

urlpatterns = router.urls