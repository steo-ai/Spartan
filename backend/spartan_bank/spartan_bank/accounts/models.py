from django.db import models
from django.contrib.auth.models import User
from django.db import transaction as db_transaction
from django.utils import timezone
from django.db.transaction import atomic
from django.db.models import Sum
import uuid
from cryptography.fernet import Fernet, InvalidToken
from decimal import Decimal, InvalidOperation
from datetime import timedelta
from django.conf import settings
from dateutil.relativedelta import relativedelta
from django.apps import apps
import logging

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────
# Encryption Setup - Safe Initialization
# ────────────────────────────────────────────────
try:
    FERNET = Fernet(settings.ENCRYPTION_KEY)
    logger.info("✅ Fernet encryption initialized successfully")
except Exception as e:
    logger.error(f"❌ Failed to initialize Fernet with ENCRYPTION_KEY: {e}")
    FERNET = None  # Prevent crashes if key is invalid


class UserProfile(models.Model):
    """Extended profile with KYC, security, MFA settings and daily transaction limits"""
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    phone_number = models.CharField(max_length=15, blank=True)
    address = models.TextField(blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    national_id = models.CharField(max_length=50, blank=True)
    kyc_verified = models.BooleanField(default=False)
    bio = models.TextField(blank=True)
    security_question = models.CharField(max_length=255, blank=True)
    security_answer_hash = models.CharField(max_length=255, blank=True)
    mfa_enabled = models.BooleanField(default=True)
    otp_code = models.CharField(max_length=6, blank=True, null=True)
    otp_created_at = models.DateTimeField(null=True, blank=True)
    is_verified = models.BooleanField(default=False)

    # Biometric / Fingerprint Support
    biometric_enabled = models.BooleanField(
        default=False, 
        help_text="User has enabled fingerprint or face ID login"
    )
    last_biometric_login = models.DateTimeField(
        null=True, 
        blank=True, 
        help_text="Last successful biometric login timestamp"
    )

    @property
    def otp_is_valid(self):
        if not self.otp_code or not self.otp_created_at:
            return False
        return timezone.now() <= self.otp_created_at + timedelta(minutes=10)

    # Daily transaction limits (in KES)
    daily_deposit_limit = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('500000.00')
    )
    daily_withdrawal_limit = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('500000.00')
    )
    daily_transfer_limit = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('500000.00')
    )
    daily_outflow_limit = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('1000000.00')
    )

    def __str__(self):
        return f"Profile of {self.user.email or self.user.username}"

    # ====================== DAILY LIMIT METHODS ======================

    def get_daily_used_deposits(self):
        Transfer = apps.get_model('payments', 'Transfer')
        today = timezone.now().date()
        total = Transfer.objects.filter(
            sender_account__user=self.user,
            transfer_type='deposit_mpesa',
            status__in=['completed', 'mpesa_confirmed'],
            initiated_at__date=today
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        return total

    def get_remaining_daily_deposits(self):
        return max(Decimal('0'), self.daily_deposit_limit - self.get_daily_used_deposits())

    def get_daily_used_outflows(self):
        """Total outflow today: withdrawals + internal transfers + bills + airtime"""
        today = timezone.now().date()
        total = Decimal('0.00')

        # 1. From Transfer model
        Transfer = apps.get_model('payments', 'Transfer')
        transfer_total = Transfer.objects.filter(
            sender_account__user=self.user,
            initiated_at__date=today,
            status__in=['completed', 'mpesa_confirmed', 'pending']
        ).aggregate(total=Sum('total_debited'))['total'] or Decimal('0.00')
        total += transfer_total

        # 2. From BillPayment (normal bills)
        BillPayment = apps.get_model('bills', 'BillPayment')
        bill_total = BillPayment.objects.filter(
            user_account__user=self.user,
            initiated_at__date=today,
            status__in=['completed', 'processing']
        ).aggregate(total=Sum('total_debited'))['total'] or Decimal('0.00')
        total += bill_total

        # 3. From AirtimeTopup
        AirtimeTopup = apps.get_model('bills', 'AirtimeTopup')
        airtime_total = AirtimeTopup.objects.filter(
            user_account__user=self.user,
            initiated_at__date=today,
            status__in=['completed', 'processing']
        ).aggregate(total=Sum('total_debited'))['total'] or Decimal('0.00')
        total += airtime_total

        return total

    def get_remaining_daily_outflows(self):
        """Remaining daily outflow limit"""
        used = self.get_daily_used_outflows()
        return max(Decimal('0'), getattr(self, 'daily_outflow_limit', Decimal('0')) - used)


# Signal to auto-create profile
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)


class Account(models.Model):
    """Bank account with encrypted account number and balance"""
    ACCOUNT_TYPES = (
        ('savings', 'Savings'),
        ('checking', 'Checking'),
        ('loan', 'Loan Account'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='accounts')
    account_type = models.CharField(max_length=10, choices=ACCOUNT_TYPES, default='savings')
    
    account_number_encrypted = models.BinaryField(editable=False, null=True, blank=True)
    balance_encrypted = models.BinaryField(editable=False, null=True, blank=True)

    interest_rate = models.DecimalField(max_digits=5, decimal_places=2, default=3.50)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=['user', 'created_at'])]

    # ====================== HELPER: SAFE DECRYPT ======================
    def _safe_decrypt(self, encrypted_field):
        """Safely decrypt BinaryField which may return memoryview/bytearray"""
        if not encrypted_field or FERNET is None:
            return None

        try:
            token = encrypted_field
            if isinstance(token, (memoryview, bytearray)):
                token = bytes(token)
            elif isinstance(token, str):
                token = token.encode('utf-8')
            elif not isinstance(token, bytes):
                token = bytes(token)

            return FERNET.decrypt(token).decode('utf-8')
        except InvalidToken:
            logger.warning(f"Invalid token during decryption (account {self.id})")
            raise
        except Exception as e:
            logger.error(f"Decryption failed for account {self.id}: {e}")
            raise

    # ====================== BALANCE PROPERTY ======================
    @property
    def balance(self):
        if not self.balance_encrypted or FERNET is None:
            return Decimal('0.00')
        
        try:
            decrypted_str = self._safe_decrypt(self.balance_encrypted)
            return Decimal(decrypted_str)
        except (InvalidToken, InvalidOperation, ValueError, TypeError) as e:
            logger.error(f"Balance decryption failed for account {self.id}: {e}")
            return Decimal('0.00')

    @balance.setter
    def balance(self, value):
        if FERNET is None:
            logger.error("Cannot set balance: Fernet is not initialized")
            return

        if value is None:
            self.balance_encrypted = None
            return

        try:
            normalized = Decimal(value).quantize(Decimal('0.01'))
            plain_text = str(normalized)
            self.balance_encrypted = FERNET.encrypt(plain_text.encode('utf-8'))
        except Exception as e:
            logger.error(f"Failed to encrypt balance for account {self.id}: {e}")
            raise

    # ====================== ACCOUNT NUMBER PROPERTY ======================
    @property
    def account_number(self):
        if not self.account_number_encrypted or FERNET is None:
            return "not-generated-yet"
        
        try:
            decrypted = self._safe_decrypt(self.account_number_encrypted)
            return decrypted
        except InvalidToken:
            logger.warning(f"Invalid token for account number decryption (account {self.id})")
            return "decryption-failed-invalid-token"
        except Exception as e:
            logger.error(f"Account number decryption failed for account {self.id}: {e}")
            return "decryption-error"

    def save(self, *args, **kwargs):
        if not self.account_number_encrypted and self.user_id:
            try:
                ts = int(timezone.now().timestamp())
                rand = uuid.uuid4().hex[:8].upper()
                plain = f"SPBK-{self.user.id:06d}-{ts}-{rand}"
                self.account_number_encrypted = FERNET.encrypt(plain.encode('utf-8'))
            except Exception as e:
                logger.error(f"Failed to encrypt account number for user {self.user_id}: {e}")
                raise

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.email or self.user.username} – {self.account_type} ({self.account_number})"

    def apply_monthly_interest(self):
        if self.account_type != 'savings' or self.balance <= 0:
            return
        monthly_rate = self.interest_rate / 100 / 12
        interest = self.balance * monthly_rate
        with atomic():
            self.balance += interest
            self.save()
            Transaction.objects.create(
                account=self,
                amount=interest,
                transaction_type='interest',
                description='Monthly interest credit',
                balance_after=self.balance
            )


class Transaction(models.Model):
    TRANSACTION_TYPES = (
        ('deposit', 'Deposit'),
        ('withdraw', 'Withdrawal'),
        ('transfer_out', 'Transfer Out'),
        ('transfer_in', 'Transfer In'),
        ('interest', 'Interest'),
        ('fee', 'Fee'),
        ('loan_disbursement', 'Loan Disbursement'),
        ('loan_repayment', 'Loan Repayment'),
    )

    CATEGORY_CHOICES = (
        ('salary', 'Salary / Income'),
        ('business', 'Business / Sales'),
        ('remittance', 'Remittance / Money Received'),
        ('groceries', 'Groceries / Food'),
        ('transport', 'Transport / Fuel'),
        ('utilities', 'Utilities / Bills'),
        ('education', 'Education / School Fees'),
        ('health', 'Medical / Health'),
        ('entertainment', 'Entertainment / Leisure'),
        ('shopping', 'Shopping / Personal'),
        ('travel', 'Travel'),
        ('investment', 'Investment / Savings'),
        ('loan', 'Loan Related'),
        ('other', 'Other'),
    )

    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='transactions')
    related_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='related_transactions'
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, blank=True, default='')
    description = models.CharField(max_length=255, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    balance_after = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.transaction_type} {self.amount} – {self.timestamp}"


class TrustedDevice(models.Model):
    """Tracks trusted devices for security (including biometric/fingerprint)"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='trusted_devices')
    token = models.CharField(max_length=128, unique=True)
    user_agent = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    device_name = models.CharField(max_length=100, blank=True)
    
    # Biometric fields
    is_biometric = models.BooleanField(default=False, help_text="This device was registered using fingerprint/face ID")
    biometric_type = models.CharField(
        max_length=20,
        choices=[
            ('fingerprint', 'Fingerprint'),
            ('face_id', 'Face ID'),
            ('other', 'Other Biometric')
        ],
        default='fingerprint'
    )
    
    last_used = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'token')

    def __str__(self):
        bio = f" ({self.get_biometric_type_display()})" if self.is_biometric else ""
        return f"{self.user} – {self.device_name or 'Unknown device'}{bio} ({self.last_used.date()})"


class LoanSchedule(models.Model):
    """Monthly amortization schedule for a loan"""
    loan = models.ForeignKey('LoanApplication', on_delete=models.CASCADE, related_name='schedule')
    due_date = models.DateField()
    installment_amount = models.DecimalField(max_digits=14, decimal_places=2)
    principal_component = models.DecimalField(max_digits=14, decimal_places=2)
    interest_component = models.DecimalField(max_digits=14, decimal_places=2)
    remaining_balance = models.DecimalField(max_digits=14, decimal_places=2)
    paid = models.BooleanField(default=False)
    actual_payment_date = models.DateTimeField(null=True, blank=True)
    late_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        ordering = ['due_date']
        unique_together = ('loan', 'due_date')

    def __str__(self):
        return f"Loan {self.loan.id} - Due {self.due_date} ({'Paid' if self.paid else 'Pending'})"

    def mark_as_paid(self, payment_amount=None, payment_date=None):
        if not payment_date:
            payment_date = timezone.now()
        self.paid = True
        self.actual_payment_date = payment_date
        if payment_amount:
            pass
        self.save()


class LoanApplication(models.Model):
    STATUS = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('active', 'Active'),
        ('repaid', 'Fully Repaid'),
        ('defaulted', 'Defaulted'),
    )

    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='loan_applications')
    loan_account = models.OneToOneField(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='linked_loan_application'
    )

    disbursement_transfer = models.OneToOneField(
        'payments.Transfer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='loan_disbursement',
        help_text="The pending/completed transfer that disbursed this loan"
    )

    amount_requested = models.DecimalField(max_digits=14, decimal_places=2)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2, default=12.00)
    term_months = models.PositiveIntegerField()

    status = models.CharField(max_length=10, choices=STATUS, default='pending')
    applied_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_loans'
    )

    amount_disbursed = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    disbursed_at = models.DateTimeField(null=True, blank=True)

    total_repaid = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    last_repayment_date = models.DateTimeField(null=True, blank=True)
    total_interest = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    next_due_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['-applied_at']

    def __str__(self):
        return f"Loan #{self.id} - {self.account} - {self.status}"

    def send_loan_email(self, subject, message):
        from django.core.mail import send_mail
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[self.account.user.email],
            fail_silently=False,
        )

    @staticmethod
    def apply_for_loan(account, amount_requested, interest_rate=12.00, term_months=6):
        loan = LoanApplication.objects.create(
            account=account,
            amount_requested=amount_requested,
            interest_rate=interest_rate,
            term_months=term_months,
            status='pending'
        )

        Transaction.objects.create(
            account=account,
            amount=amount_requested,
            transaction_type='loan_disbursement',
            category='loan',
            description=f"Loan application #{loan.id} – PENDING disbursement",
            balance_after=account.balance,
        )

        loan.send_loan_email(
            subject='Spartan Bank – Loan Application Received',
            message=f'Your loan application for KES {amount_requested:,.2f} has been received.\n'
                    f'Application ID: #{loan.id}\n\nWe will review it shortly.'
        )
        return loan

    def approve(self, approver, disbursed_amount=None):
        if self.status != 'pending':
            logger.warning(f"Loan #{self.id} is not pending. Current status: {self.status}")
            return False

        if disbursed_amount is None:
            disbursed_amount = self.amount_requested

        logger.info(f"🚀 Starting loan approval for Loan #{self.id} - Amount: {disbursed_amount}")

        try:
            with db_transaction.atomic():
                logger.info("   1. Creating loan liability account...")
                loan_account = Account.objects.create(
                    user=self.account.user,
                    account_type='loan',
                    is_active=True,
                )
                loan_account.balance = -disbursed_amount
                loan_account.save()

                logger.info("   2. Updating loan application status...")
                self.loan_account = loan_account
                self.status = 'approved'
                self.approved_at = timezone.now()
                self.approved_by = approver
                self.amount_disbursed = disbursed_amount
                self.save()

                self.generate_amortization_schedule()

                # ====================== CREATE PENDING TRANSFER ======================
                logger.info("   3. Creating pending Transfer in payments app...")
                from payments.models import Transfer

                transfer = Transfer.objects.create(
                    sender_account=self.account,
                    receiver_account=None,
                    amount=disbursed_amount,
                    fee=Decimal('0.00'),
                    total_debited=disbursed_amount,
                    transfer_type='loan_disbursement',
                    description=f"Disbursement for Loan Application #{self.id}",
                    status='pending'
                )

                self.disbursement_transfer = transfer
                self.save()

                logger.info(f"✅ SUCCESS: Pending Transfer #{transfer.id} created (loan_disbursement)")

                # Send notification
                self.send_loan_email(
                    subject='Spartan Bank – Loan Approved – Awaiting Disbursement',
                    message=f'Your loan of KES {disbursed_amount:,.2f} has been approved.\n'
                            f'Loan ID: #{self.id}\nFinal disbursement is pending admin confirmation.'
                )

                from notifications.signals import send_loan_notification
                send_loan_notification(self, "approved")

                logger.info(f"✅ Loan #{self.id} fully approved and pending transfer created.")
                return True

        except Exception as e:
            logger.error(f"❌ FAILED to approve Loan #{self.id}: {e}", exc_info=True)
            return False
        
    @property
    def remaining_balance(self):
        if not self.amount_disbursed:
            return self.amount_requested

        unpaid = self.schedule.filter(paid=False).aggregate(
            total=Sum('installment_amount') + Sum('late_fee', default=Decimal('0.00'))
        )['total'] or Decimal('0.00')

        calculated_remaining = max(Decimal('0.00'), 
                                   self.amount_disbursed + self.total_interest - self.total_repaid)
        
        return max(unpaid, calculated_remaining)

    def mark_as_fully_repaid(self):
        self.status = 'repaid'
        self.save()
        self.send_loan_email(
            subject='Spartan Bank – Loan Fully Repaid 🎉',
            message=f'Congratulations! Your loan #{self.id} has been fully repaid.\n'
                    f'You can now apply for a new loan.'
        )
        from notifications.signals import send_loan_notification
        send_loan_notification(self, "fully_repaid")

    def check_for_default(self):
        if self.status in ['repaid', 'defaulted']:
            return
        today = timezone.now().date()
        oldest_unpaid = self.schedule.filter(paid=False).order_by('due_date').first()
        if oldest_unpaid and (today - oldest_unpaid.due_date).days > 60:
            self.status = 'defaulted'
            self.save()

    def generate_amortization_schedule(self):
        if not self.amount_disbursed or self.term_months < 1:
            return

        principal = self.amount_disbursed
        monthly_rate = (self.interest_rate / Decimal('100')) / Decimal('12')

        if monthly_rate == 0:
            emi = principal / self.term_months
        else:
            power = (Decimal('1') + monthly_rate) ** self.term_months
            emi = principal * monthly_rate * power / (power - 1)

        emi = emi.quantize(Decimal('0.01'))

        self.total_interest = Decimal('0.00')
        balance = principal
        start_date = self.disbursed_at.date() if self.disbursed_at else timezone.now().date()

        self.schedule.all().delete()

        for i in range(1, self.term_months + 1):
            interest = (balance * monthly_rate).quantize(Decimal('0.01'))
            principal_payment = (emi - interest).quantize(Decimal('0.01'))
            balance = (balance - principal_payment).quantize(Decimal('0.01'))

            due_date = start_date + relativedelta(months=+i)

            LoanSchedule.objects.create(
                loan=self,
                due_date=due_date,
                installment_amount=emi,
                principal_component=principal_payment,
                interest_component=interest,
                remaining_balance=max(balance, Decimal('0.00')),
            )

            self.total_interest += interest

        self.next_due_date = self.schedule.first().due_date if self.schedule.exists() else None
        self.save()