from rest_framework.routers import DefaultRouter
from .views import CardViewSet, GlobalCardTransactionViewSet   # ← add here

router = DefaultRouter()
router.register(r'cards', CardViewSet, basename='card')
router.register(r'card-transactions', GlobalCardTransactionViewSet, basename='card-transaction')

urlpatterns = router.urls