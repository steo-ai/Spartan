# payments/admin.py
from django.contrib import admin
from django.utils.html import format_html
from django.contrib import messages
from django.db import transaction as db_transaction
from django.utils import timezone

from .models import Transfer, MpesaTransaction
from accounts.models import Transaction


@admin.register(Transfer)
class TransferAdmin(admin.ModelAdmin):
    list_display = (
        'reference_link',
        'sender_account',
        'formatted_amount',
        'transfer_type',
        'colored_status',
        'mpesa_receipt',
        'initiated_at',
        'completed_at',
    )
    list_display_links = ('reference_link',)
    
    list_filter = ('transfer_type', 'status', 'initiated_at')
    search_fields = ('reference', 'sender_account__account_number',
                     'sender_account__user__email', 'external_reference', 'phone_number')
    
    readonly_fields = ('reference', 'total_debited', 'initiated_at', 'completed_at')
    
    date_hierarchy = 'initiated_at'
    ordering = ('-initiated_at',)

    actions = ['approve_pending_till_deposits', 'approve_confirmed_stk_deposits']

    def reference_link(self, obj):
        return format_html('<a href="{}">{}</a>', obj.id, obj.reference)
    reference_link.short_description = "Reference"

    def formatted_amount(self, obj):
        return f"KES {obj.amount:,.2f}"
    formatted_amount.short_description = "Amount"

    def mpesa_receipt(self, obj):
        return obj.external_reference or "—"
    mpesa_receipt.short_description = "M-Pesa Receipt No."

    def colored_status(self, obj):
        colors = {
            'completed': 'green',
            'mpesa_confirmed': 'blue',
            'pending': 'orange',
            'failed': 'red',
            'cancelled': 'gray'
        }
        color = colors.get(obj.status, 'black')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>', 
            color, 
            obj.get_status_display()
        )
    colored_status.short_description = "Status"

    # Actions remain the same (you can keep them as they were)
    @admin.action(description="✅ Approve Manual Till Deposits (Pending)")
    def approve_pending_till_deposits(self, request, queryset):
        if not request.user.is_superuser:
            messages.error(request, "Only superusers can approve deposits.")
            return
        approved_count = 0
        with db_transaction.atomic():
            for transfer in queryset.filter(transfer_type='deposit_mpesa', status='pending'):
                try:
                    account = transfer.sender_account
                    account.balance += transfer.amount
                    account.save()
                    Transaction.objects.create(
                        account=account,
                        amount=transfer.amount,
                        transaction_type='deposit',
                        description=f"M-Pesa Till deposit approved (ref: {transfer.reference}) (Receipt: {transfer.external_reference})",
                        balance_after=account.balance,
                        category='deposit'
                    )
                    transfer.status = 'completed'
                    transfer.completed_at = timezone.now()
                    transfer.save()
                    approved_count += 1
                except Exception as e:
                    messages.error(request, f"Failed to approve {transfer.reference}: {str(e)}")
        if approved_count > 0:
            messages.success(request, f"✅ {approved_count} Manual Till deposit(s) approved!")
        else:
            messages.warning(request, "No pending manual Till deposits selected.")

    @admin.action(description="✅ Approve STK Push Deposits (M-Pesa Confirmed)")
    def approve_confirmed_stk_deposits(self, request, queryset):
        if not request.user.is_superuser:
            messages.error(request, "Only superusers can approve deposits.")
            return
        approved_count = 0
        with db_transaction.atomic():
            for transfer in queryset.filter(transfer_type='deposit_mpesa', status='mpesa_confirmed'):
                try:
                    account = transfer.sender_account
                    account.balance += transfer.amount
                    account.save()
                    Transaction.objects.create(
                        account=account,
                        amount=transfer.amount,
                        transaction_type='deposit',
                        description=f"M-Pesa STK deposit approved (ref: {transfer.reference})",
                        balance_after=account.balance,
                        category='deposit'
                    )
                    transfer.status = 'completed'
                    transfer.completed_at = timezone.now()
                    transfer.save()
                    approved_count += 1
                except Exception as e:
                    messages.error(request, f"Failed to approve {transfer.reference}: {str(e)}")
        if approved_count > 0:
            messages.success(request, f"✅ {approved_count} STK Push deposit(s) approved and credited!")
        else:
            messages.warning(request, "No M-Pesa confirmed deposits selected.")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(MpesaTransaction)
class MpesaTransactionAdmin(admin.ModelAdmin):
    list_display = (
        'checkout_request_id',
        'transfer_reference',
        'result_code_colored',      # Fixed method name
        'mpesa_receipt_number',
        'created_at',
    )
    list_filter = ('result_code', 'created_at', 'callback_received_at')
    search_fields = ('checkout_request_id', 'mpesa_receipt_number', 'transfer__reference')
    
    readonly_fields = (
        'created_at', 'callback_received_at', 'checkout_request_id',
        'merchant_request_id', 'result_code', 'result_description',
        'mpesa_receipt_number', 'transfer'
    )

    def transfer_reference(self, obj):
        if obj.transfer:
            return format_html('<a href="/admin/payments/transfer/{}/change/">{}</a>',
                               obj.transfer.id, obj.transfer.reference)
        return "—"
    transfer_reference.short_description = "Transfer Ref"

    def result_code_colored(self, obj):
        """Fixed: Proper format_html usage"""
        if obj.result_code == 0:
            return format_html(
                '<span style="color: green; font-weight: bold;">Success (0)</span>'
            )
        elif obj.result_code is None:
            return format_html(
                '<span style="color: orange; font-weight: bold;">Pending</span>'
            )
        else:
            return format_html(
                '<span style="color: red; font-weight: bold;">Failed ({})</span>', 
                obj.result_code
            )
    result_code_colored.short_description = "Result Code"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser