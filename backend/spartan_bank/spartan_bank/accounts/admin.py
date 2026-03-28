from django.contrib import admin
from .models import UserProfile, Account, Transaction, LoanApplication

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'phone_number', 'kyc_verified', 'mfa_enabled')
    search_fields = ('user__email', 'phone_number')

@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('account_number', 'user', 'account_type', 'balance', 'is_active')
    list_filter = ('account_type', 'is_active')
    search_fields = ('user__email',)

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'account', 'transaction_type', 'category', 'amount', 'balance_after')
    list_filter = ('transaction_type', 'category')
    date_hierarchy = 'timestamp'

@admin.register(LoanApplication)
class LoanApplicationAdmin(admin.ModelAdmin):
    list_display = ('account', 'amount_requested', 'status', 'applied_at', 'approved_at')
    list_filter = ('status',)
    date_hierarchy = 'applied_at'