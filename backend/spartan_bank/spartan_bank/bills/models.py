# bills/models.py
from django.db import models, transaction
from django.utils import timezone
from decimal import Decimal, InvalidOperation

from accounts.models import Account, Transaction
from payments.models import Transfer


class BillCategory(models.Model):
    """
    Predefined bill types (airtime, utilities, subscriptions, etc.)
    """
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=80, unique=True)
    paybill_number = models.CharField(max_length=20, blank=True)
    account_number_label = models.CharField(max_length=80, blank=True)
    min_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('10.00'))
    max_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('500000.00'))
    icon_class = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = "Bill Categories"

    def __str__(self):
        return self.name


class BillPayment(models.Model):
    """
    Record of a bill payment attempt / completion.
    Linked to a Transfer record for money movement & audit trail.
    """
    STATUS_CHOICES = (
        ('pending',     'Pending'),
        ('processing',  'Processing'),
        ('completed',   'Completed'),
        ('failed',      'Failed'),
        ('cancelled',   'Cancelled'),
    )

    user_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name='bill_payments'
    )
    category = models.ForeignKey(
        BillCategory,
        on_delete=models.PROTECT
    )
    transfer = models.OneToOneField(
        Transfer,
        on_delete=models.PROTECT,
        related_name='bill_payment',
        null=True,
        blank=True
    )

    paybill_number = models.CharField(max_length=20)
    account_number = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    total_debited = models.DecimalField(max_digits=12, decimal_places=2)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    description = models.CharField(max_length=255, blank=True)
    reference = models.CharField(max_length=100, unique=True, blank=True)
    external_reference = models.CharField(max_length=100, blank=True)

    initiated_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-initiated_at']
        indexes = [
            models.Index(fields=['user_account', 'status']),
            models.Index(fields=['reference']),
            models.Index(fields=['external_reference']),
        ]

    def __str__(self):
        return f"{self.category.name} – {self.amount} – {self.status}"

    def save(self, *args, **kwargs):
        if not self.reference:
            ts = timezone.now().strftime('%Y%m%d%H%M%S')
            self.reference = f"BILL-{ts}-{self.user_account_id or 0:06d}"

        if not self.description:
            self.description = f"{self.category.name} payment for {self.account_number}"

        try:
            self.total_debited = self.amount + self.fee
        except (InvalidOperation, TypeError):
            self.total_debited = Decimal('0.00')

        super().save(*args, **kwargs)

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.amount <= 0:
            raise ValidationError("Amount must be positive")
        if self.fee < 0:
            raise ValidationError("Fee cannot be negative")
        if self.total_debited != self.amount + self.fee:
            raise ValidationError("total_debited must equal amount + fee")

    def can_execute(self):
        if self.status != 'pending':
            return False, f"Cannot execute — status is {self.status}"
        if self.user_account.balance < self.total_debited:
            return False, "Insufficient funds"
        return True, "OK"

    @transaction.atomic
    def execute(self):
        """
        Execute bill payment with proper balance deduction and audit trail.
        """
        can_exec, msg = self.can_execute()
        if not can_exec:
            return False, msg

        self.status = 'processing'
        self.save(update_fields=['status'])

        try:
            # ───────────────────────────────────────────────
            # REAL INTEGRATION POINT (replace placeholder later)
            # ───────────────────────────────────────────────
            success = True  # ← Replace with actual M-Pesa Paybill / Pesapal call
            external_ref = f"PAY-{timezone.now().strftime('%Y%m%d%H%M%S')}"
            # ───────────────────────────────────────────────

            if success:
                # 1. Deduct balance FIRST (critical)
                self.user_account.balance -= self.total_debited
                self.user_account.save()

                # 2. Update BillPayment status
                self.status = 'completed'
                self.external_reference = external_ref
                self.completed_at = timezone.now()

                # 3. Create unified Transfer record
                if not self.transfer:
                    self.transfer = Transfer.objects.create(
                        sender_account=self.user_account,
                        receiver_account=None,
                        amount=self.amount,
                        fee=self.fee,
                        total_debited=self.total_debited,
                        transfer_type='bill_payment',
                        description=self.description,
                        reference=self.reference,
                        external_reference=external_ref,
                        external_provider='mpesa_paybill',
                        status='completed',
                        completed_at=self.completed_at,
                    )

                # 4. Create Transaction record (this triggers notification automatically)
                Transaction.objects.create(
                    account=self.user_account,
                    amount=-self.total_debited,
                    transaction_type='bill_payment',
                    category=self.category.slug if self.category else None,
                    description=self.description,
                    balance_after=self.user_account.balance,
                    related_account=None,
                )

                self.save(update_fields=['status', 'external_reference', 'completed_at', 'transfer'])

                return True, "Payment successful"

            else:
                self.status = 'failed'
                self.save(update_fields=['status'])
                return False, "Payment gateway rejected the request"

        except Exception as exc:
            self.status = 'failed'
            self.save(update_fields=['status'])
            return False, f"Unexpected error: {str(exc)}"


class AirtimeProvider(models.Model):
    """
    Mobile operators (Safaricom, Airtel, Telkom)
    """
    name = models.CharField(max_length=50, unique=True)
    short_name = models.CharField(max_length=20)
    default_paybill = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class DataBundle(models.Model):
    """
    Predefined popular data bundles per provider
    """
    provider = models.ForeignKey(AirtimeProvider, on_delete=models.CASCADE, related_name='bundles')
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    data_amount = models.CharField(max_length=50)
    validity_days = models.PositiveIntegerField(default=1)
    is_popular = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['provider', 'amount']
        unique_together = ['provider', 'amount', 'data_amount']

    def __str__(self):
        return f"{self.provider.short_name} - {self.name} ({self.amount} KES)"


class AirtimeTopup(BillPayment):
    """
    Specialized subclass for airtime & bundles.
    Inherits execute() from BillPayment but can override if needed.
    """
    provider = models.ForeignKey(AirtimeProvider, on_delete=models.PROTECT)
    phone_number = models.CharField(max_length=15)
    is_bundle = models.BooleanField(default=False)
    bundle = models.ForeignKey(DataBundle, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name = "Airtime / Bundle Top-up"

    def execute(self):
        """
        Optional override for airtime-specific logic.
        For now, we reuse BillPayment.execute() but set correct transaction_type.
        """
        # You can add airtime-specific gateway call here in the future
        return super().execute()