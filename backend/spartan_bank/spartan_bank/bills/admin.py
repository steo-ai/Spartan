# bills/admin.py
from django.contrib import admin
from .models import (
    BillCategory,
    BillPayment,
    AirtimeProvider,
    DataBundle,
    AirtimeTopup,
)


@admin.register(BillCategory)
class BillCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'paybill_number', 'account_number_label', 
                    'min_amount', 'max_amount', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name', 'slug', 'paybill_number')
    prepopulated_fields = {'slug': ('name',)}
    ordering = ('name',)


@admin.register(BillPayment)
class BillPaymentAdmin(admin.ModelAdmin):
    list_display = ('reference', 'category', 'user_account', 'amount', 
                    'status', 'initiated_at', 'completed_at')
    list_filter = ('status', 'category', 'initiated_at')
    search_fields = ('reference', 'account_number', 'user_account__user__email')
    readonly_fields = ('reference', 'total_debited', 'initiated_at', 'completed_at')
    date_hierarchy = 'initiated_at'

    def has_add_permission(self, request):
        return request.user.is_superuser


# ────────────────────────────────────────────────────────────────
# AirtimeProvider Admin
# ────────────────────────────────────────────────────────────────
@admin.register(AirtimeProvider)
class AirtimeProviderAdmin(admin.ModelAdmin):
    list_display = ('name', 'short_name', 'default_paybill', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name', 'short_name')
    ordering = ('name',)


# ────────────────────────────────────────────────────────────────
# DataBundle Admin
# ────────────────────────────────────────────────────────────────
@admin.register(DataBundle)
class DataBundleAdmin(admin.ModelAdmin):
    list_display = ('name', 'provider', 'amount', 'data_amount', 
                    'validity_days', 'is_popular', 'is_active')
    list_filter = ('provider', 'is_popular', 'is_active')
    search_fields = ('name', 'code', 'provider__name')
    raw_id_fields = ('provider',)          # Great for performance with many providers
    ordering = ('provider', 'amount')


# ────────────────────────────────────────────────────────────────
# AirtimeTopup Admin (inherits from BillPayment but customized)
# ────────────────────────────────────────────────────────────────
@admin.register(AirtimeTopup)
class AirtimeTopupAdmin(admin.ModelAdmin):
    list_display = ('reference', 'provider', 'phone_number', 'amount', 
                    'is_bundle', 'status', 'initiated_at', 'completed_at')
    list_filter = ('status', 'provider', 'is_bundle', 'initiated_at')
    search_fields = ('reference', 'phone_number', 'user_account__user__email')
    readonly_fields = ('reference', 'total_debited', 'initiated_at', 'completed_at')
    date_hierarchy = 'initiated_at'

    def has_add_permission(self, request):
        return request.user.is_superuser

    # Optional: Show parent fields from BillPayment
    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'provider', 'bundle', 'user_account', 'category'
        )