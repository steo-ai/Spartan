from django.db import models
from django.utils import timezone
from decimal import Decimal
import random
import string
from datetime import timedelta

from accounts.models import Account, Transaction


class Card(models.Model):
    CARD_TYPES = (
        ('debit_physical', 'Physical Debit Card'),
        ('debit_virtual', 'Virtual Debit Card'),
        ('prepaid', 'Prepaid Card'),           # optional future extension
    )

    STATUS_CHOICES = (
        ('active', 'Active'),
        ('frozen', 'Frozen'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled'),
        ('lost_stolen', 'Reported Lost/Stolen'),
    )

    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='cards')
    card_type = models.CharField(max_length=20, choices=CARD_TYPES, default='debit_virtual')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    # Core card details — NEVER store real PAN/CVV in production (use tokenization!)
    # This is demo/fake data only
    card_number = models.CharField(max_length=19, unique=True, editable=False)
    expiry_date = models.DateField()
    cvv = models.CharField(max_length=3, editable=False)           # shown once on creation
    pin = models.CharField(max_length=4, blank=True, default='')   # 4-digit card PIN

    # Spending controls
    daily_spend_limit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('100000.00'))
    transaction_limit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('50000.00'))
    used_today = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))  # reset daily

    issued_at    = models.DateTimeField(auto_now_add=True)
    last_used    = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-issued_at']
        indexes = [
            models.Index(fields=['account', 'status']),
        ]

    def __str__(self):
        masked = f"**** **** **** {self.card_number[-4:]}"
        return f"{self.get_card_type_display()} ({masked}) – {self.status}"

    def save(self, *args, **kwargs):
        if not self.card_number:
            # Generate fake but realistic-looking Visa card number
            self.card_number = '4' + ''.join(random.choices(string.digits, k=15))
            self.cvv = ''.join(random.choices(string.digits, k=3))

            # ─── Improved expiry logic ────────────────────────────────────────
            now = timezone.now()
            # Base: 5 years from now
            years = 5
            # Add random 0–11 months variation so cards don't all expire same month
            extra_months = random.randint(0, 11)
            self.expiry_date = (now + timedelta(days=365 * years) + timedelta(days=30 * extra_months)).date()

            # Auto-generate random 4-digit PIN if not already set
            if not self.pin:
                self.pin = ''.join(random.choices(string.digits, k=4))

        super().save(*args, **kwargs)

    def set_random_pin(self):
        """Force regenerate a new random PIN (e.g. after reveal abuse or user request)"""
        self.pin = ''.join(random.choices(string.digits, k=4))
        self.save(update_fields=['pin'])

    @property
    def masked_number(self):
        return f"**** **** **** {self.card_number[-4:]}"

    @property
    def masked_cvv(self):
        return "•••"

    def freeze(self):
        if self.status == 'active':
            self.status = 'frozen'
            self.save(update_fields=['status'])
            return True
        return False

    def unfreeze(self):
        if self.status == 'frozen':
            self.status = 'active'
            self.save(update_fields=['status'])
            return True
        return False

    def check_and_update_expiry(self):
        """
        Call this before any transaction or when displaying card.
        Automatically marks card as expired if date passed.
        """
        if timezone.now().date() > self.expiry_date:
            if self.status != 'expired':
                self.status = 'expired'
                self.save(update_fields=['status'])
            return True, 'expired'
        return False, 'valid'

    def is_valid_for_transaction(self, amount: Decimal):
        # First check expiry and auto-update status if needed
        is_expired, reason = self.check_and_update_expiry()
        if is_expired:
            return False, "Card expired"

        if self.status != 'active':
            return False, "Card is not active"

        if amount > self.transaction_limit:
            return False, f"Amount exceeds per-transaction limit (KES {self.transaction_limit:,.2f})"

        if self.used_today + amount > self.daily_spend_limit:
            remaining = self.daily_spend_limit - self.used_today
            return False, f"Daily limit exceeded. Remaining: KES {remaining:,.2f}"

        return True, "OK"

    def record_usage(self, amount: Decimal, description: str):
        """Record card usage & create linked transaction record"""
        self.used_today += amount
        self.last_used = timezone.now()
        self.save(update_fields=['used_today', 'last_used'])

        # Create audit-style transaction record
        Transaction.objects.create(
            account=self.account,
            amount=-amount,
            transaction_type='card_purchase',
            description=f"Card payment: {description} (Card ending {self.card_number[-4:]})",
            balance_after=self.account.balance  # ← should be updated BEFORE calling this
        )


class CardTransaction(models.Model):
    """
    Detailed per-transaction log (useful for statements, disputes, analytics)
    """
    card = models.ForeignKey(Card, on_delete=models.CASCADE, related_name='transactions')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    merchant_name    = models.CharField(max_length=255, blank=True)
    merchant_category = models.CharField(max_length=100, blank=True)
    status = models.CharField(
        max_length=20,
        default='approved',
        choices=[('approved', 'Approved'), ('declined', 'Declined'), ('pending', 'Pending')]
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    reference = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = "Card Transaction"
        verbose_name_plural = "Card Transactions"

    def __str__(self):
        return f"{self.amount} – {self.card} – {self.timestamp.date()}"