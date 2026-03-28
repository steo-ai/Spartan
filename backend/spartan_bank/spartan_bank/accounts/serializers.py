from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from .models import UserProfile, Account, Transaction, LoanApplication, LoanSchedule
from decimal import Decimal
from django.utils import timezone

User = get_user_model()

SECURITY_QUESTIONS = [
    "What was the name of your first pet?",
    "What city were you born in?",
    "What is your mother's maiden name?",
    "What was your first school called?",
    "What is the name of the street you grew up on?",
]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True
    )
    security_question = serializers.ChoiceField(
        choices=SECURITY_QUESTIONS,
        write_only=True
    )
    security_answer = serializers.CharField(write_only=True, min_length=4)

    first_name = serializers.CharField(required=True, max_length=150)
    last_name = serializers.CharField(required=True, max_length=150)
    phone_number = serializers.CharField(required=False, allow_blank=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True)
    national_id = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'email', 'password', 'password_confirm', 'first_name', 'last_name',
            'security_question', 'security_answer', 'phone_number',
            'date_of_birth', 'address', 'national_id',
        ]

    def validate(self, data):
        if 'password_confirm' in data and data['password_confirm']:
            if data['password'] != data['password_confirm']:
                raise serializers.ValidationError({
                    "password_confirm": "Passwords do not match."
                })
        return data

    def validate_email(self, value):
        normalized = value.lower()
        if User.objects.filter(email=normalized).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized

    def create(self, validated_data):
        password = validated_data.pop('password')
        validated_data.pop('password_confirm', None)

        security_question = validated_data.pop('security_question', None)
        security_answer = validated_data.pop('security_answer', None)

        profile_data = {
            'phone_number': validated_data.pop('phone_number', ''),
            'date_of_birth': validated_data.pop('date_of_birth', None),
            'address': validated_data.pop('address', ''),
            'national_id': validated_data.pop('national_id', ''),
        }

        user = User.objects.create_user(
            username=validated_data['email'],
            email=validated_data.pop('email'),
            password=password,
            first_name=validated_data.pop('first_name', ''),
            last_name=validated_data.pop('last_name', ''),
            **validated_data
        )

        profile = user.userprofile
        if security_question and security_answer:
            profile.security_question = security_question
            profile.security_answer_hash = make_password(security_answer)

        for key, value in profile_data.items():
            if value is not None:
                setattr(profile, key, value)

        profile.save()

        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'username']
        read_only_fields = ['id']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if ret.get('username') == ret.get('email'):
            ret.pop('username', None)
        return ret


class UserProfileSerializer(serializers.ModelSerializer):
    email = serializers.CharField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'phone_number', 'address', 'date_of_birth', 'national_id',
            'kyc_verified', 'bio', 'mfa_enabled',
            'daily_deposit_limit', 'daily_withdrawal_limit',
            'daily_transfer_limit', 'daily_outflow_limit',
        ]
        read_only_fields = ['id', 'kyc_verified']

    def get_full_name(self, obj):
        return f"{obj.user.first_name or ''} {obj.user.last_name or ''}".strip()


class AccountSerializer(serializers.ModelSerializer):
    account_number = serializers.ReadOnlyField()
    user_email = serializers.CharField(source='user.email', read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = [
            'id', 'account_type', 'account_number', 'balance',
            'interest_rate', 'created_at', 'is_active', 'user',
            'user_email', 'full_name',
        ]
        read_only_fields = ['id', 'account_number', 'balance', 'created_at', 'user']

    def get_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip()


class TransactionSerializer(serializers.ModelSerializer):
    account_number = serializers.CharField(source='account.account_number', read_only=True)
    related_account_number = serializers.CharField(
        source='related_account.account_number', read_only=True, allow_null=True
    )
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = Transaction
        fields = [
            'id', 'account', 'account_number', 'related_account',
            'related_account_number', 'amount', 'transaction_type',
            'category', 'category_display', 'description',
            'timestamp', 'balance_after',
        ]
        read_only_fields = ['timestamp', 'balance_after']


class LoanScheduleSerializer(serializers.ModelSerializer):
    """Serializer for individual schedule entries"""
    due_date = serializers.DateField(read_only=True)
    installment_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    principal_component = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    interest_component = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    remaining_balance = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    late_fee = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = LoanSchedule
        fields = [
            'due_date', 'installment_amount', 'principal_component',
            'interest_component', 'remaining_balance', 'paid',
            'actual_payment_date', 'late_fee'
        ]


class LoanApplicationSerializer(serializers.ModelSerializer):
    account_number = serializers.CharField(source='account.account_number', read_only=True)
    applicant_email = serializers.CharField(source='account.user.email', read_only=True)
    applicant_full_name = serializers.SerializerMethodField()

    # New fields from enhanced model
    loan_account_number = serializers.CharField(source='loan_account.account_number', read_only=True, allow_null=True)
    total_interest = serializers.SerializerMethodField()
    next_due_date = serializers.SerializerMethodField()

    # Calculated fields
    remaining_balance = serializers.SerializerMethodField()
    total_payable = serializers.SerializerMethodField()
    monthly_emi = serializers.SerializerMethodField()
    days_since_applied = serializers.SerializerMethodField()
    progress_percentage = serializers.SerializerMethodField()

    # Schedule - FIXED: Removed redundant source='schedule'
    schedule = LoanScheduleSerializer(many=True, read_only=True)

    class Meta:
        model = LoanApplication
        fields = [
            'id',
            'account',
            'account_number',
            'loan_account_number',
            'applicant_email',
            'applicant_full_name',
            'amount_requested',
            'amount_disbursed',
            'interest_rate',
            'term_months',
            'status',
            'applied_at',
            'approved_at',
            'disbursed_at',
            'approved_by',
            'total_repaid',
            'last_repayment_date',
            'total_interest',
            'next_due_date',

            # Calculated fields
            'remaining_balance',
            'total_payable',
            'monthly_emi',
            'days_since_applied',
            'progress_percentage',
            'schedule',
        ]
        read_only_fields = [
            'id', 'applied_at', 'approved_at', 'disbursed_at', 'approved_by',
            'amount_disbursed', 'total_repaid', 'last_repayment_date',
            'total_interest', 'next_due_date', 'loan_account_number'
        ]

    def get_applicant_full_name(self, obj):
        return f"{obj.account.user.first_name or ''} {obj.account.user.last_name or ''}".strip()

    def get_remaining_balance(self, obj):
        return float(obj.remaining_balance)

    def get_total_payable(self, obj):
        if not obj.amount_disbursed:
            return 0.0
        return float(obj.amount_disbursed + (obj.total_interest or 0))

    def get_monthly_emi(self, obj):
        if not obj.schedule.exists():
            return 0.0
        return float(obj.schedule.first().installment_amount)

    def get_total_interest(self, obj):
        return float(obj.total_interest or 0)

    def get_next_due_date(self, obj):
        if obj.next_due_date:
            return obj.next_due_date.strftime('%Y-%m-%d')
        return None

    def get_days_since_applied(self, obj):
        if not obj.applied_at:
            return 0
        delta = timezone.now() - obj.applied_at
        return delta.days

    def get_progress_percentage(self, obj):
        if not obj.amount_disbursed or obj.amount_disbursed == 0:
            return 0.0
        total_owed = obj.amount_disbursed + (obj.total_interest or 0)
        paid = obj.total_repaid
        if total_owed == 0:
            return 0.0
        return round(min(100.0, (paid / total_owed) * 100), 2)

    def validate(self, data):
        if data.get('term_months', 0) < 1:
            raise serializers.ValidationError({"term_months": "Term must be at least 1 month"})
        if data.get('interest_rate', 0) <= 0:
            raise serializers.ValidationError({"interest_rate": "Interest rate must be positive"})
        return data