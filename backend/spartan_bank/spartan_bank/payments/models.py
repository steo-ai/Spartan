from django.db import models
from django.utils import timezone
from decimal import Decimal

from accounts.models import Account, Transaction, UserProfile


class Transfer(models.Model):
    """
    Unified model for all money movement.
    Now supports manual M-Pesa Till deposits with admin approval.
    """
    TRANSFER_TYPES = (
        ('internal_same_user', 'Between own accounts'),
        ('internal_other_user', 'To another Spartan user'),
        ('external_mpesa', 'To M-Pesa'),
        ('deposit_mpesa', 'M-Pesa Deposit'),
        ('withdraw_mpesa', 'M-Pesa Withdrawal'),
        ('external_pesalink', 'To other bank via Pesalink'),
        ('bill_payment', 'Bill / Airtime payment'),
        ('loan_disbursement', 'Loan Disbursement'),

    )

    STATUS_CHOICES = (
        ('pending', 'Pending (Admin Review)'),
        ('mpesa_confirmed', 'M-Pesa Confirmed'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    )

    sender_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name='sent_transfers',
        help_text="Target account for deposits"
    )
    receiver_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name='received_transfers',
        null=True,
        blank=True,
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    total_debited = models.DecimalField(max_digits=14, decimal_places=2)
    transfer_type = models.CharField(max_length=30, choices=TRANSFER_TYPES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    description = models.CharField(max_length=255, blank=True)
    reference = models.CharField(max_length=100, unique=True, blank=True)
    initiated_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # M-Pesa specific
    external_reference = models.CharField(max_length=100, blank=True, 
        help_text="M-Pesa Receipt Number (e.g. LHG123456K)")
    external_provider = models.CharField(max_length=50, blank=True, default='mpesa_till')
    phone_number = models.CharField(max_length=15, blank=True)

    class Meta:
        ordering = ['-initiated_at']
        indexes = [
            models.Index(fields=['reference']),
            models.Index(fields=['status', 'transfer_type']),
            models.Index(fields=['sender_account', 'initiated_at']),
        ]

    def __str__(self):
        return f"{self.get_transfer_type_display()} {self.amount:,.2f} - {self.status}"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = f"TRF-{timezone.now().strftime('%Y%m%d%H%M%S')}-{self.sender_account_id:06d}"
        super().save(*args, **kwargs)


class MpesaTransaction(models.Model):
    """Kept for your existing STK Push flow"""
    transfer = models.OneToOneField(
        Transfer,
        on_delete=models.CASCADE,
        related_name='mpesa_transaction',
        null=True,
        blank=True
    )
    checkout_request_id = models.CharField(max_length=100, unique=True, blank=True)
    merchant_request_id = models.CharField(max_length=100, blank=True)
    result_code = models.IntegerField(null=True)
    result_description = models.TextField(blank=True)
    mpesa_receipt_number = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    callback_received_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "M-Pesa Transactions"

    def __str__(self):
        return f"M-Pesa {self.checkout_request_id[:12] if self.checkout_request_id else 'pending'}"