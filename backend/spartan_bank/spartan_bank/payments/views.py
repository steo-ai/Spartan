from decimal import Decimal, InvalidOperation
from django.db.models import Count
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.response import Response
from django.db import transaction as db_transaction
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from .models import Transfer, MpesaTransaction
from .serializers import TransferSerializer
from .payment_client import PaymentClient
from accounts.models import Account, Transaction, UserProfile


class PaymentViewSet(viewsets.GenericViewSet):
    """
    Payments app handles M-Pesa integration + Loan Disbursements.
    All money movements now go through this unified approval system.
    """
    permission_classes = [IsAuthenticated]
    client = PaymentClient()

    MAX_SINGLE = Decimal('250000.00')

    def _get_profile(self):
        return self.request.user.userprofile

    # ====================== M-PESA DEPOSIT (STK Push) ======================
    @db_transaction.atomic
    @action(detail=False, methods=['post'])
    def deposit(self, request):
        """Initiate M-Pesa deposit via STK Push"""
        account_id = request.data.get('account')
        amount_str = request.data.get('amount')
        phone = request.data.get('phone_number') or self.request.user.userprofile.phone_number
        description = request.data.get('description', 'M-Pesa Deposit')

        try:
            amount = Decimal(amount_str)
            account = Account.objects.get(id=account_id, user=request.user, is_active=True)
        except (InvalidOperation, Account.DoesNotExist, TypeError):
            return Response({"error": "Invalid amount or account"}, status=400)

        if amount <= 0 or amount > self.MAX_SINGLE:
            return Response({"error": f"Amount must be between 1 and {self.MAX_SINGLE:,.2f} KES"}, status=400)

        profile = self._get_profile()
        used = profile.get_daily_used_deposits()
        if used + amount > profile.daily_deposit_limit:
            remaining = profile.get_remaining_daily_deposits()
            return Response({"error": f"Daily deposit limit exceeded. Remaining: KES {remaining:,.2f}"}, status=403)

        # Create Transfer record first
        transfer = Transfer.objects.create(
            sender_account=account,
            amount=amount,
            fee=Decimal('0.00'),
            total_debited=amount,
            transfer_type='deposit_mpesa',
            description=description,
            phone_number=phone,
            status='pending'
        )

        try:
            stk_response = self.client.initiate_stk_push(phone, amount, transfer.reference)
        except Exception as e:
            transfer.status = 'failed'
            transfer.save()
            return Response({"error": f"STK Push initiation failed: {str(e)}"}, status=500)

        if stk_response.get('ResponseCode') != '0':
            transfer.status = 'failed'
            transfer.save()
            return Response({
                "error": "STK Push failed",
                "response": stk_response
            }, status=400)

        # Create MpesaTransaction record
        MpesaTransaction.objects.create(
            transfer=transfer,
            checkout_request_id=stk_response.get('CheckoutRequestID'),
            merchant_request_id=stk_response.get('MerchantRequestID', '')
        )

        # Improved response for frontend
        return Response({
            "success": True,
            "message": "M-Pesa prompt sent. Complete payment on your phone.",
            "transfer_id": transfer.id,
            "reference": transfer.reference,
            "checkout_request_id": stk_response.get('CheckoutRequestID'),
            "status": "pending"
        }, status=202)

    # ====================== MANUAL M-PESA TILL DEPOSIT ======================
    @action(detail=False, methods=['post'])
    def deposit_till(self, request):
        """Manual Till deposit with receipt number"""
        account_id = request.data.get('account')
        amount_str = request.data.get('amount')
        mpesa_receipt = request.data.get('mpesa_receipt_number', '').strip().upper()
        description = request.data.get('description', 'M-Pesa Till Deposit')

        if not mpesa_receipt or len(mpesa_receipt) < 8:
            return Response({"error": "Valid M-Pesa receipt number is required"}, status=400)

        try:
            amount = Decimal(amount_str)
            account = Account.objects.get(id=account_id, user=request.user, is_active=True)
        except (InvalidOperation, Account.DoesNotExist, TypeError):
            return Response({"error": "Invalid amount or account"}, status=400)

        if amount <= 0:
            return Response({"error": "Amount must be greater than 0"}, status=400)

        profile = self._get_profile()
        used = profile.get_daily_used_deposits()
        if used + amount > profile.daily_deposit_limit:
            remaining = profile.get_remaining_daily_deposits()
            return Response({"error": f"Daily deposit limit exceeded. Remaining: KES {remaining:,.2f}"}, status=403)

        transfer = Transfer.objects.create(
            sender_account=account,
            amount=amount,
            fee=Decimal('0.00'),
            total_debited=amount,
            transfer_type='deposit_mpesa',
            description=description,
            external_reference=mpesa_receipt,
            phone_number=request.user.userprofile.phone_number or "",
            status='pending'
        )

        return Response({
            "success": True,
            "message": "M-Pesa Till deposit submitted successfully. Waiting for admin approval.",
            "transfer_id": transfer.id,
            "reference": transfer.reference,
            "receipt_number": mpesa_receipt,
            "status": "pending"
        }, status=201)

    # ====================== M-PESA WITHDRAWAL ======================
    @db_transaction.atomic
    @action(detail=False, methods=['post'])
    def withdraw(self, request):
        """Request M-Pesa withdrawal"""
        account_id = request.data.get('account')
        amount_str = request.data.get('amount')
        phone = request.data.get('phone_number')
        description = request.data.get('description', 'M-Pesa Withdrawal')
    
        try:
            amount = Decimal(amount_str)
            account = Account.objects.get(id=account_id, user=request.user, is_active=True)
        except (InvalidOperation, Account.DoesNotExist, TypeError):
            return Response({"error": "Invalid amount or account"}, status=400)
    
        if amount <= 0 or amount > self.MAX_SINGLE:
            return Response({"error": f"Amount must be between 1 and {self.MAX_SINGLE:,.2f} KES"}, status=400)
    
        if amount > account.balance:
            return Response({"error": "Insufficient funds"}, status=400)
    
        profile = self._get_profile()
        used = profile.get_daily_used_withdrawals()
        if used + amount > profile.daily_withdrawal_limit:
            return Response({"error": "Daily withdrawal limit exceeded"}, status=403)
    
        with db_transaction.atomic():
            account.balance -= amount
            account.save()
    
            transfer = Transfer.objects.create(
                sender_account=account,
                amount=amount,
                fee=Decimal('15.00'),
                total_debited=amount + Decimal('15.00'),
                transfer_type='withdraw_mpesa',
                description=description,
                phone_number=phone,
                status='pending'
            )
    
            Transaction.objects.create(
                account=account,
                amount=-amount,
                transaction_type='withdraw',
                description=f"Pending M-Pesa withdrawal (ref: {transfer.reference})",
                balance_after=account.balance,
                category='withdrawal'
            )
    
        return Response({
            "success": True,
            "message": "Withdrawal request submitted. Funds deducted. Awaiting admin approval.",
            "transfer_id": transfer.id,
            "new_balance": f"{account.balance:,.2f} KES"
        }, status=202)

    # ====================== INTERNAL TRANSFER ======================
    @db_transaction.atomic
    @action(detail=False, methods=['post'], url_path='internal_transfer')
    def internal_transfer(self, request):
        """Transfer money between two Spartan accounts"""
        from_account_id = request.data.get('from_account')
        to_account_id = request.data.get('to_account')
        amount_str = request.data.get('amount')
        description = request.data.get('description', 'Internal Transfer')
    
        try:
            amount = Decimal(amount_str)
            from_account = Account.objects.get(id=from_account_id, user=request.user, is_active=True)
            to_account = Account.objects.get(id=to_account_id, is_active=True)
        except (InvalidOperation, Account.DoesNotExist, TypeError):
            return Response({"error": "Invalid amount or account(s)"}, status=400)
    
        if amount <= 0:
            return Response({"error": "Amount must be greater than 0"}, status=400)
    
        if from_account.id == to_account.id:
            return Response({"error": "Cannot transfer to the same account"}, status=400)
    
        if amount > from_account.balance:
            return Response({"error": "Insufficient funds"}, status=400)
    
        profile = self._get_profile()
        used_outflow = abs(profile.get_daily_used_outflows())
        if used_outflow + amount > profile.daily_outflow_limit:
            remaining = profile.daily_outflow_limit - used_outflow
            return Response({
                "error": f"Daily outflow limit exceeded. Remaining: KES {remaining:,.2f}"
            }, status=403)
    
        with db_transaction.atomic():
            from_account.balance -= amount
            from_account.save()
    
            to_account.balance += amount
            to_account.save()
    
            Transaction.objects.create(
                account=from_account,
                related_account=to_account,
                amount=-amount,
                transaction_type='transfer_out',
                description=description,
                balance_after=from_account.balance,
                category='transfer'
            )
    
            Transaction.objects.create(
                account=to_account,
                related_account=from_account,
                amount=amount,
                transaction_type='transfer_in',
                description=description,
                balance_after=to_account.balance,
                category='transfer'
            )
    
            transfer = Transfer.objects.create(
                sender_account=from_account,
                receiver_account=to_account,
                amount=amount,
                fee=Decimal('0.00'),
                total_debited=amount,
                transfer_type='internal_other_user' if from_account.user != to_account.user else 'internal_same_user',
                description=description,
                status='completed',
                completed_at=timezone.now()
            )
    
        return Response({
            "success": True,
            "message": "Internal transfer completed successfully!",
            "transfer_id": transfer.id,
            "reference": transfer.reference,
            "new_balance": f"{from_account.balance:,.2f} KES",
            "from_account": from_account.account_number,
            "to_account": to_account.account_number,
            "amount": float(amount)
        }, status=200)

    # ====================== DARAJA CALLBACK ======================
    @method_decorator(csrf_exempt)
    @action(detail=False, methods=['post'], permission_classes=[AllowAny], url_path='mpesa-callback')
    def mpesa_callback(self, request):
        try:
            body = request.data.get('Body', {})
            stk_callback = body.get('stkCallback', {})
            checkout_id = stk_callback.get('CheckoutRequestID')
            result_code = stk_callback.get('ResultCode')
            result_desc = stk_callback.get('ResultDesc')

            if not checkout_id:
                return Response({"status": "ignored"}, status=200)

            mpesa_tx = MpesaTransaction.objects.filter(checkout_request_id=checkout_id).first()
            if not mpesa_tx:
                return Response({"status": "ignored"}, status=200)

            transfer = mpesa_tx.transfer

            if result_code == 0:
                transfer.status = 'mpesa_confirmed'
                transfer.save()

                mpesa_tx.result_code = result_code
                mpesa_tx.result_description = result_desc or "Success"
                mpesa_tx.mpesa_receipt_number = stk_callback.get('MpesaReceiptNumber', '')
                mpesa_tx.callback_received_at = timezone.now()
                mpesa_tx.save()

            else:
                transfer.status = 'failed'
                mpesa_tx.result_code = result_code
                mpesa_tx.result_description = result_desc or "Failed"
                mpesa_tx.save()
                transfer.save()

            return Response({"status": "processed"}, status=200)

        except Exception as e:
            print(f"[MPESA CALLBACK] ERROR: {str(e)}")
            return Response({"status": "error", "detail": str(e)}, status=200)

    # ====================== ADMIN APPROVE ENDPOINT ======================
    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def approve(self, request, pk=None):
        """Unified approval endpoint for all pending transfers"""
        transfer = self.get_object()

        if transfer.status not in ['pending', 'mpesa_confirmed']:
            return Response({"error": f"Cannot approve this transfer. Current status: {transfer.status}"}, status=400)

        # Loan Disbursement
        if transfer.transfer_type == 'loan_disbursement':
            loan = getattr(transfer, 'loan_disbursement', None)
            if not loan:
                return Response({"error": "No linked loan found for this disbursement"}, status=400)

            try:
                with db_transaction.atomic():
                    account = transfer.sender_account
                    account.balance += transfer.amount
                    account.save()

                    Transaction.objects.create(
                        account=account,
                        amount=transfer.amount,
                        transaction_type='loan_disbursement',
                        category='loan',
                        description=transfer.description or f"Loan #{loan.id} disbursed",
                        balance_after=account.balance,
                        related_account=getattr(loan, 'loan_account', None),
                    )

                    loan.status = 'active'
                    loan.disbursed_at = timezone.now()
                    loan.save()

                    transfer.status = 'completed'
                    transfer.completed_at = timezone.now()
                    transfer.save()

                return Response({
                    "message": "Loan disbursed successfully!",
                    "loan_id": loan.id,
                    "credited_account": account.account_number,
                    "amount": float(transfer.amount),
                    "new_balance": float(account.balance)
                }, status=200)

            except Exception as e:
                return Response({"error": f"Failed to disburse loan: {str(e)}"}, status=500)

        # Withdrawal
        elif transfer.transfer_type == 'withdraw_mpesa':
            with db_transaction.atomic():
                transfer.status = 'completed'
                transfer.completed_at = timezone.now()
                transfer.save()

            return Response({
                "message": "Withdrawal approved and processed.",
                "transfer": TransferSerializer(transfer, context={'request': request}).data
            })

        # Other transfers (including deposits)
        else:
            with db_transaction.atomic():
                if transfer.transfer_type == 'deposit_mpesa' and transfer.status == 'mpesa_confirmed':
                    account = transfer.sender_account
                    account.balance += transfer.amount
                    account.save()

                    Transaction.objects.create(
                        account=account,
                        amount=transfer.amount,
                        transaction_type='deposit',
                        category='deposit',
                        description=transfer.description or "M-Pesa deposit approved",
                        balance_after=account.balance,
                    )

                transfer.status = 'completed'
                transfer.completed_at = timezone.now()
                transfer.save()

            return Response({
                "message": "Transfer approved successfully.",
                "transfer": TransferSerializer(transfer, context={'request': request}).data
            })

    # ====================== FREQUENT RECIPIENTS ======================
    @action(detail=False, methods=['get'], url_path='frequent-recipients')
    def frequent_recipients(self, request):
        limit = int(request.query_params.get('limit', 5))

        user_accounts = Account.objects.filter(user=request.user)

        frequent_qs = Transaction.objects.filter(
            account__in=user_accounts,
            transaction_type='transfer_out',
            related_account__isnull=False
        ).select_related('related_account', 'related_account__user') \
         .values(
            'related_account_id',
            'related_account__user__first_name',
            'related_account__user__last_name',
         ).annotate(
            transfer_count=Count('id')
         ).order_by('-transfer_count')[:limit]

        recipients = []
        for item in frequent_qs:
            related_account_id = item['related_account_id']
            related_account = Account.objects.filter(id=related_account_id).first()

            if related_account:
                account_number = related_account.account_number
                last_six = account_number[-6:] if account_number and len(account_number) > 6 else account_number
            else:
                account_number = "Unknown"
                last_six = "XXXXXX"

            full_name = f"{item.get('related_account__user__first_name') or ''} {item.get('related_account__user__last_name') or ''}".strip()
            display_name = full_name or f"Account {last_six}"

            recipients.append({
                "id": related_account_id,
                "name": display_name,
                "account_number": account_number,
                "short_account": f"••••{last_six}",
                "type": "spartan",
                "transfer_count": item['transfer_count']
            })

        return Response({
            "results": recipients,
            "count": len(recipients)
        })

    # ====================== CHECK DEPOSIT STATUS (FIXED) ======================
    @action(detail=False, methods=['get'], url_path='check-deposit-status')
    def check_deposit_status(self, request):
        """Poll endpoint for frontend to check deposit status"""
        transfer_id = request.query_params.get('transfer_id')
        if not transfer_id:
            return Response({"error": "transfer_id is required"}, status=400)

        try:
            transfer = Transfer.objects.get(
                id=transfer_id, 
                sender_account__user=request.user
            )
            return Response({
                "success": True,
                "status": transfer.status,
                "reference": transfer.reference,
                "amount": float(transfer.amount),
                "transfer_id": transfer.id
            })
        except Transfer.DoesNotExist:
            return Response({"error": "Transaction not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)