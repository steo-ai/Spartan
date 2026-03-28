from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/accounts/', include('accounts.urls')),
    path('api/payments/', include('payments.urls')),
    path('api-auth/', include('rest_framework.urls')),
    path('api/cards/', include('cards.urls')),
    path('api/bills/', include('bills.urls')),
    path('api/notifications/', include('notifications.urls')),
]