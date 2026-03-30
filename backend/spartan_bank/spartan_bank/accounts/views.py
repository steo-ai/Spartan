from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.contrib.auth.hashers import check_password
from django.db import transaction as db_transaction
from django.core.mail import send_mail
from rest_framework import serializers
from django.conf import settings
from django_ratelimit.decorators import ratelimit
from django.http import HttpResponse, StreamingHttpResponse, JsonResponse
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.utils import timezone
from django.template.loader import render_to_string
from weasyprint import HTML
from django.db.models import Sum, Q
from datetime import timedelta
import csv
import json
import secrets
import random
import string
import logging


from .models import Account, Transaction, LoanApplication, UserProfile, TrustedDevice
from .serializers import (
    AccountSerializer, TransactionSerializer,
    LoanApplicationSerializer, RegisterSerializer, UserProfileSerializer, BiometricLoginSerializer
)


logger = logging.getLogger(__name__)
User = get_user_model()

@csrf_exempt
@ratelimit(key='ip', rate='5/m', block=True)
def register_view(request):
    if request.method != 'POST':
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
        print("DEBUG REGISTER → Payload:", data)
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    serializer = RegisterSerializer(data=data)

    if not serializer.is_valid():
        print("DEBUG REGISTER → Validation errors:", serializer.errors)
        return JsonResponse(serializer.errors, status=400)

    try:
        user = serializer.save()
        print("DEBUG REGISTER → User created:", user.email, user.id)

        # Generate and save OTP
        otp = ''.join(random.choices(string.digits, k=6))
        profile = user.userprofile
        profile.otp_code = otp
        profile.otp_created_at = timezone.now()
        profile.is_verified = False
        profile.save(update_fields=['otp_code', 'otp_created_at', 'is_verified'])

        print("DEBUG REGISTER → OTP saved:", otp)

        # Send email
        send_mail(
            subject='Spartan Bank – Verify Your Email',
            message=f'Your verification code is: {otp}\n\nValid for 10 minutes.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )

        return JsonResponse({
            "message": "Account created. Check your email for OTP.",
            "email": user.email
        }, status=201)

    except Exception as e:
        print("DEBUG REGISTER → Error:", str(e))
        return JsonResponse({"detail": "Server error during registration"}, status=500)


@csrf_exempt
@ratelimit(key='ip', rate='5/m', block=True)
def verify_otp_view(request):
    if request.method != 'POST':
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
        email = data.get('email')
        otp = data.get('otp')

        if not email or not otp:
            return JsonResponse({"detail": "Email and OTP required"}, status=400)

        user = User.objects.get(email=email.lower())
        profile = user.userprofile

        if not profile.otp_code or not profile.otp_created_at:
            return JsonResponse({"detail": "No OTP found"}, status=400)

        if (timezone.now() - profile.otp_created_at) > timedelta(minutes=10):
            return JsonResponse({"detail": "OTP expired"}, status=400)

        if profile.otp_code != otp:
            return JsonResponse({"detail": "Incorrect OTP"}, status=400)

        # ====================== SUCCESSFUL VERIFICATION ======================
        profile.is_verified = True
        profile.otp_code = None
        profile.otp_created_at = None
        profile.save()

        # Send Welcome Email after successful registration
        send_mail(
            subject="🎉 Welcome to Spartan Bank – Your Account is Ready!",
            message=f"""
Dear {user.first_name or 'Valued Customer'},

Congratulations! Your Spartan Bank account has been successfully created and verified.

You can now:
• Log in to your account
• Open Savings or Checking accounts
• Apply for instant loans
• Make secure transfers and payments

Account Email: {user.email}

We are excited to have you as part of the Spartan Bank family.

Best regards,
The Spartan Bank Team
Secure • Reliable • Instant
            """.strip(),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )

        return JsonResponse({
            "message": "Email verified successfully. Welcome to Spartan Bank!",
            "email": user.email
        }, status=200)

    except User.DoesNotExist:
        return JsonResponse({"detail": "User not found"}, status=404)
    except Exception as e:
        print("VERIFY OTP ERROR:", str(e))
        return JsonResponse({"detail": "Server error"}, status=500)

@csrf_exempt
@ratelimit(key='ip', rate='3/m', block=True)
def resend_otp_view(request):
    if request.method != 'POST':
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
        email = data.get('email')

        if not email:
            return JsonResponse({"detail": "Email required"}, status=400)

        user = User.objects.get(email=email.lower())
        profile = user.userprofile

        otp = ''.join(random.choices(string.digits, k=6))
        profile.otp_code = otp
        profile.otp_created_at = timezone.now()
        profile.is_verified = False
        profile.save(update_fields=['otp_code', 'otp_created_at', 'is_verified'])

        send_mail(
            subject='Spartan Bank – New Verification Code',
            message=f'Your new code: {otp}\n\nValid for 10 minutes.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )

        return JsonResponse({
            "message": "New OTP sent. Check your email.",
            "email": user.email
        }, status=200)

    except User.DoesNotExist:
        return JsonResponse({"detail": "User not found"}, status=404)
    except Exception as e:
        print("RESEND OTP ERROR:", str(e))
        return JsonResponse({"detail": "Server error"}, status=500)


@method_decorator(csrf_exempt, name='dispatch')
@method_decorator(ratelimit(key='ip', rate='10/m', block=True), name='post')
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        print("DEBUG LOGIN → Payload:", request.data)

        email = (request.data.get('email') or '').lower().strip()
        password = request.data.get('password')
        device_token = request.data.get('device_token')
        device_name = request.data.get('device_name', 'Unknown')

        if not email or not password:
            return Response({"detail": "Email and password required"}, status=400)

        user = authenticate(username=email, password=password)
        if not user:
            print(f"DEBUG LOGIN → Auth failed for {email}")
            return Response({"detail": "Invalid credentials"}, status=401)

        profile = user.userprofile

        # Trusted device → instant login
        if device_token and TrustedDevice.objects.filter(user=user, token=device_token).exists():
            print(f"DEBUG LOGIN → Trusted device success: {device_name}")

            refresh = RefreshToken.for_user(user)
            response = Response({
                "message": "Login successful (trusted device)",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                }
            })

            response.set_cookie('access', str(refresh.access_token), httponly=True, secure=False, samesite='Lax', max_age=3600)
            response.set_cookie('refresh', str(refresh), httponly=True, secure=False, samesite='Lax', max_age=604800)

            return response

        # New device → challenge
        if not profile.security_question or not profile.security_answer_hash:
            return Response({"detail": "Security question not set"}, status=400)

        print(f"DEBUG LOGIN → Security challenge for {email}")
        return Response({
            "challenge": "security_question",
            "question": profile.security_question,
            "email": email
        }, status=202)


@method_decorator(csrf_exempt, name='dispatch')
@method_decorator(ratelimit(key='ip', rate='5/m', block=True), name='post')
class VerifySecurityQuestionView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        print("DEBUG VERIFY QUESTION → Payload:", request.data)

        email = (request.data.get('email') or request.data.get('email_address') or '').lower().strip()
        answer = (
            request.data.get('answer') or 
            request.data.get('security_answer') or 
            request.data.get('securityAnswer') or 
            ''
        ).strip()
        device_name = request.data.get('device_name', 'Unknown')

        if not email or not answer:
            return Response({"detail": "Email and answer required"}, status=400)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=404)

        profile = user.userprofile

        if not check_password(answer, profile.security_answer_hash):
            return Response({"detail": "Incorrect security answer"}, status=400)

        # Trust this device
        device_token = secrets.token_urlsafe(64)
        TrustedDevice.objects.create(
            user=user,
            token=device_token,
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            ip_address=request.META.get('REMOTE_ADDR'),
            device_name=device_name
        )

        refresh = RefreshToken.for_user(user)

        response = Response({
            "message": "Device trusted. Login successful.",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "device_token": device_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
            }
        })

        response.set_cookie('access', str(refresh.access_token), httponly=True, secure=False, samesite='Lax', max_age=3600)
        response.set_cookie('refresh', str(refresh), httponly=True, secure=False, samesite='Lax', max_age=604800)

        return response


User = get_user_model()

class ProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.none()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Only allow users to access their own profile"""
        return UserProfile.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        """Get current user's profile"""
        profile = request.user.userprofile
        serializer = UserProfileSerializer(profile, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='enable-biometric')
    def enable_biometric(self, request):
        """Enable Face ID / Fingerprint / Biometric login on current device"""
        serializer = BiometricLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        device_token = serializer.validated_data['device_token']
        device_name = serializer.validated_data.get('device_name', 'User Device')
        
        # Safely get and validate biometric_type
        biometric_type = request.data.get('biometric_type', 'fingerprint').lower().strip()
        if biometric_type not in ['fingerprint', 'face_id', 'other']:
            biometric_type = 'fingerprint'

        try:
            # Create or update trusted device
            trusted_device, created = TrustedDevice.objects.get_or_create(
                user=request.user,
                token=device_token,
                defaults={
                    'device_name': device_name,
                    'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                    'ip_address': request.META.get('REMOTE_ADDR'),
                    'is_biometric': True,
                    'biometric_type': biometric_type,
                }
            )

            if not created:
                trusted_device.is_biometric = True
                trusted_device.biometric_type = biometric_type
                trusted_device.device_name = device_name
                trusted_device.user_agent = request.META.get('HTTP_USER_AGENT', trusted_device.user_agent)
                trusted_device.ip_address = request.META.get('REMOTE_ADDR', trusted_device.ip_address)
                trusted_device.save()

            # Update profile
            profile = request.user.userprofile
            profile.biometric_enabled = True
            profile.last_biometric_login = timezone.now()
            profile.save(update_fields=['biometric_enabled', 'last_biometric_login'])

            return Response({
                "message": "Biometric login enabled successfully",
                "device_token": device_token,
                "device_name": device_name,
                "biometric_type": biometric_type,
                "is_new_device": created
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Enable biometric error for user {request.user.email}: {e}", exc_info=True)
            return Response({
                "detail": "Failed to enable biometric login. Please try again."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
class AccountViewSet(viewsets.ModelViewSet):
    serializer_class = AccountSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        return Account.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    # In accounts/views.py  (inside AccountViewSet class)

    @action(detail=False, methods=['post'], url_path='open_account')
    def open_account(self, request):
        account_type = request.data.get('account_type')

        if not account_type:
            return Response({"detail": "account_type is required"}, status=status.HTTP_400_BAD_REQUEST)

        valid_types = ['savings', 'checking', 'loan']
        if account_type not in valid_types:
            return Response(
                {"detail": f"Invalid account_type. Must be one of: {', '.join(valid_types)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if self.get_queryset().filter(account_type=account_type).exists():
            return Response(
                {"detail": f"You already have a {account_type} account"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with db_transaction.atomic():
                new_account = Account.objects.create(
                    user=request.user,
                    account_type=account_type,
                    is_active=True,
                )

                # Create opening transaction
                Transaction.objects.create(
                    account=new_account,
                    amount=Decimal('0.00'),
                    transaction_type='deposit',
                    category='account_opening',
                    description=f"Opened new {account_type} account",
                    balance_after=new_account.balance,
                )

            # ==================== SEND SUCCESS EMAIL ====================
            account_type_display = new_account.get_account_type_display()
            
            send_mail(
                subject=f'Spartan Bank – Your {account_type_display} Account Created Successfully',
                message=f"""
Dear {request.user.first_name or request.user.email},

Your new **{account_type_display} Account** has been successfully created!

Account Details:
• Account Type: {account_type_display}
• Account Number: {new_account.account_number}
• Status: Active
• Date Created: {new_account.created_at.strftime('%Y-%m-%d %H:%M')}

You can now start using your new account for deposits, transfers, and other banking services.

Thank you for choosing Spartan Bank.

Best regards,
Spartan Bank Team
                """.strip(),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[request.user.email],
                fail_silently=False,
            )

            serializer = self.get_serializer(new_account)
            return Response({
                "message": f"{account_type_display} account created successfully",
                "account": serializer.data
            }, status=status.HTTP_201_CREATED)

        except Exception as exc:
            print("Account creation error:", str(exc))
            return Response({"detail": f"Failed to create account: {str(exc)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    # Mini-statement, export-csv, export-pdf, and deprecated actions remain unchanged
    @action(detail=True, methods=['get'], url_path='mini-statement')
    def mini_statement(self, request, pk=None):
        account = self.get_object()
        try:
            days = int(request.query_params.get('days', 30))
            limit = int(request.query_params.get('limit', 50))
        except ValueError:
            return Response({"detail": "days and limit must be integers"}, status=400)

        start = timezone.now() - timedelta(days=days)
        qs = Transaction.objects.filter(account=account, timestamp__gte=start).order_by('-timestamp')[:limit]

        serializer = TransactionSerializer(qs, many=True, context={'request': request})

        return Response({
            'account_number': account.account_number,
            'account_type': account.account_type,
            'current_balance': float(account.balance),
            'as_of': timezone.now().strftime('%Y-%m-%d %H:%M EAT'),
            'period': f'Last {days} days (up to {limit} transactions)',
            'transactions': serializer.data
        })

    @action(detail=True, methods=['get'], url_path='export-csv')
    def export_csv(self, request, pk=None):
        account = self.get_object()
        days = int(request.query_params.get('days', 90))
        start = timezone.now() - timedelta(days=days)

        qs = Transaction.objects.filter(account=account, timestamp__gte=start).order_by('-timestamp')

        def row_gen():
            yield ['Date', 'Type', 'Description', 'Amount (KES)', 'Balance After']
            for tx in qs.iterator():
                yield [
                    tx.timestamp.strftime('%Y-%m-%d %H:%M'),
                    tx.get_transaction_type_display(),
                    tx.description or '-',
                    f"{tx.amount:,.2f}",
                    f"{tx.balance_after:,.2f}"
                ]

        response = StreamingHttpResponse(
            (','.join(map(str, row)) + '\n' for row in row_gen()),
            content_type='text/csv'
        )
        filename = f"statement_{account.account_number[-6:]}_{timezone.now():%Y%m%d}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=['get'], url_path='export-pdf')
    def export_pdf(self, request, pk=None):
        account = self.get_object()
        start_str = request.query_params.get('start')
        end_str = request.query_params.get('end')
        days = int(request.query_params.get('days', 30))

        if start_str and end_str:
            try:
                start_date = timezone.datetime.strptime(start_str, '%Y-%m-%d').date()
                end_date = timezone.datetime.strptime(end_str, '%Y-%m-%d').date()
                start_date = timezone.make_aware(timezone.datetime.combine(start_date, timezone.min.time()))
                end_date = timezone.make_aware(timezone.datetime.combine(end_date, timezone.max.time()))
            except ValueError:
                return Response({"error": "Invalid date format (use YYYY-MM-DD)"}, status=400)
        else:
            end_date = timezone.now()
            start_date = end_date - timedelta(days=days)

        transactions = Transaction.objects.filter(
            account=account, timestamp__range=(start_date, end_date)
        ).order_by('-timestamp')[:200]

        totals = transactions.aggregate(
            total_credits=Sum('amount', filter=Q(amount__gt=0)),
            total_debits=Sum('amount', filter=Q(amount__lt=0)),
        )
        total_credits = totals['total_credits'] or Decimal('0.00')
        total_debits = totals['total_debits'] or Decimal('0.00')
        net_change = total_credits + total_debits

        context = {
            'account': account,
            'transactions': transactions,
            'today': timezone.now(),
            'user': request.user,
            'start_date': start_date,
            'end_date': end_date,
            'total_credits': total_credits,
            'total_debits': abs(total_debits),
            'net_change': net_change,
        }

        html_string = render_to_string('statements/mini_statement.html', context)
        html = HTML(string=html_string, base_url=request.build_absolute_uri())
        pdf_content = html.write_pdf()

        response = HttpResponse(content_type='application/pdf')
        filename = f"spartan_statement_{account.account_number[-6:]}_{timezone.now():%Y%m%d}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response.write(pdf_content)
        return response

    # Deprecated actions (unchanged)
    @action(detail=True, methods=['post'])
    def deposit(self, request, pk=None):
        return Response({"warning": "Deprecated. Use /payments/deposit/"}, status=410)

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        return Response({"warning": "Deprecated. Use /payments/withdraw/"}, status=410)

    @action(detail=False, methods=['post'])
    def internal_transfer(self, request):
        return Response({"warning": "Deprecated. Use /payments/internal_transfer/"}, status=410)


class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        accounts = Account.objects.filter(user=self.request.user)
        qs = Transaction.objects.filter(account__in=accounts).order_by('-timestamp')

        start = self.request.query_params.get('start')
        end = self.request.query_params.get('end')
        type_ = self.request.query_params.get('type')
        cat = self.request.query_params.get('category')
        search = self.request.query_params.get('search')

        if start:
            qs = qs.filter(timestamp__gte=start)
        if end:
            qs = qs.filter(timestamp__lte=end)
        if type_:
            qs = qs.filter(transaction_type=type_)
        if cat:
            qs = qs.filter(category=cat)
        if search:
            qs = qs.filter(
                Q(description__icontains=search) |
                Q(related_account__account_number__icontains=search) |
                Q(category__icontains=search)
            )
        return qs


# ====================== FIXED LOAN VIEWSET ======================
class LoanApplicationViewSet(viewsets.ModelViewSet):
    serializer_class = LoanApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            return LoanApplication.objects.all()
        return LoanApplication.objects.filter(account__user=self.request.user)

    def perform_create(self, serializer):
        """User applies for loan → pending stage"""
        account = serializer.validated_data['account']
        if account.user != self.request.user:
            raise serializers.ValidationError("You can only apply on your own accounts.")

        loan = LoanApplication.apply_for_loan(
            account=account,
            amount_requested=serializer.validated_data['amount_requested'],
            interest_rate=serializer.validated_data.get('interest_rate', 12.00),
            term_months=serializer.validated_data['term_months']
        )
        serializer.instance = loan

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def approve(self, request, pk=None):
        application = self.get_object()
        disbursed_amount = request.data.get('disbursed_amount')
        success = application.approve(request.user, disbursed_amount)
        if success:
            serializer = self.get_serializer(application)
            return Response({
                "message": "Loan approved successfully. Pending disbursement transfer created.",
                "loan": serializer.data
            })
        return Response({"error": "Failed to approve loan"}, status=400)

    @action(detail=True, methods=['post'])
    def repay(self, request, pk=None):
        """Make a repayment on an active loan - FIXED & IMPROVED"""
        application = self.get_object()

        if application.status not in ['active', 'approved']:
            return Response({"error": "Loan is not active"}, status=400)

        try:
            amount = Decimal(request.data.get('amount'))
            repayment_account_id = request.data.get('repayment_account')
            if amount <= 0:
                raise ValueError("Amount must be positive")
        except:
            return Response({"error": "Valid positive amount required"}, status=400)

        # Get repayment account
        try:
            repayment_account = Account.objects.get(
                id=repayment_account_id,
                user=request.user,
                is_active=True
            )
        except Account.DoesNotExist:
            return Response({"error": "Invalid repayment account"}, status=400)

        if repayment_account.balance < amount:
            return Response({"error": "Insufficient balance in selected account"}, status=400)

        with db_transaction.atomic():
            # 1. Deduct from repayment account
            repayment_account.balance -= amount
            repayment_account.save()

            # 2. Update loan totals
            application.total_repaid += amount
            application.last_repayment_date = timezone.now()

            # 3. Apply payment to schedule (oldest unpaid first)
            remaining_payment = amount
            for schedule_item in application.schedule.filter(paid=False).order_by('due_date'):
                if remaining_payment <= 0:
                    break
                due_amount = schedule_item.installment_amount + (schedule_item.late_fee or Decimal('0.00'))
                pay_now = min(remaining_payment, due_amount)
                schedule_item.mark_as_paid(pay_now)
                remaining_payment -= pay_now

            # 4. Reduce loan account liability
            if application.loan_account:
                application.loan_account.balance += amount
                application.loan_account.save()

            # 5. Create clean repayment transaction
            Transaction.objects.create(
                account=repayment_account,
                amount=-amount,
                transaction_type='loan_repayment',
                category='loan',
                description=f"Repayment for Loan #{application.id}",
                balance_after=repayment_account.balance,
                related_account=application.loan_account,
            )

            # 6. Check status
            if application.remaining_balance <= Decimal('0.01'):
                application.mark_as_fully_repaid()
            else:
                application.check_for_default()

            application.save()

        # Send email and notification
        application.send_loan_email(
            subject='Spartan Bank – Loan Repayment Received',
            message=f'Thank you! KES {amount:,.2f} has been received for Loan #{application.id}.\n'
                    f'Remaining balance: KES {application.remaining_balance:,.2f}'
        )

        from notifications.signals import send_loan_notification
        send_loan_notification(application, "repayment_received")

        serializer = self.get_serializer(application)
        return Response({
            "message": "Repayment successful",
            "remaining_balance": float(application.remaining_balance),
            "status": application.status,
            "new_account_balance": float(repayment_account.balance),
            "total_repaid": float(application.total_repaid)
        })
@method_decorator(csrf_exempt, name='dispatch')
@method_decorator(ratelimit(key='ip', rate='10/m', block=True), name='post')
class BiometricLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = BiometricLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        device_token = serializer.validated_data['device_token']
        device_name = serializer.validated_data.get('device_name', 'Biometric Device')

        try:
            trusted_device = TrustedDevice.objects.select_related('user').get(
                token=device_token,
                is_biometric=True  # ← now enforced at query level
            )
        except TrustedDevice.DoesNotExist:
            return Response({
                "detail": "Biometric not enabled on this device. Please enable it in Settings first."
            }, status=status.HTTP_403_FORBIDDEN)

        user = trusted_device.user
        profile = user.userprofile

        # Update timestamps
        profile.last_biometric_login = timezone.now()
        profile.save(update_fields=['last_biometric_login'])
        trusted_device.save(update_fields=['last_used'])

        refresh = RefreshToken.for_user(user)

        return Response({
            "message": "Biometric login successful",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
            },
            "device_name": trusted_device.device_name,
            "biometric_type": trusted_device.biometric_type
        })