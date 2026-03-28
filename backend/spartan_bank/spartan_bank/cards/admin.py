from django.contrib import admin
from .models import Card, CardTransaction


@admin.register(Card)
class CardAdmin(admin.ModelAdmin):
    list_display = (
        'masked_number', 'account', 'card_type', 'status',
        'daily_spend_limit', 'transaction_limit', 'used_today',
        'expiry_date', 'issued_at'
    )
    list_filter = ('card_type', 'status', 'issued_at')
    search_fields = ('account__user__email', 'card_number')
    readonly_fields = ('card_number', 'cvv', 'issued_at', 'last_used')
    date_hierarchy = 'issued_at'

    def has_add_permission(self, request):
        # In real system: only allow via proper issuance flow
        return request.user.is_superuser


@admin.register(CardTransaction)
class CardTransactionAdmin(admin.ModelAdmin):
    list_display = ('card', 'amount', 'merchant_name', 'status', 'timestamp')
    list_filter = ('status', 'timestamp')
    search_fields = ('card__account__user__email', 'merchant_name')
    readonly_fields = ('timestamp',)
    date_hierarchy = 'timestamp'