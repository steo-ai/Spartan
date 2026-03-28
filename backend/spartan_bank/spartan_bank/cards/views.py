from decimal import Decimal
from django.db import transaction
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle
from accounts.models import Account

from .models import Card, CardTransaction
from .serializers import CardSerializer, CardTransactionSerializer


class RevealThrottle(UserRateThrottle):
    """Custom throttle just for reveal action — prevents PIN brute-force"""
    rate = '8/minute'  # 8 attempts per minute per user — adjust as needed


class CardViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing debit/virtual cards.
    - Only cards belonging to the authenticated user's accounts are visible.
    - Full PAN & CVV are only returned once during creation or via PIN-protected reveal.
    """
    serializer_class = CardSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Card.objects.filter(account__user=self.request.user).select_related('account')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({"request": self.request})
        return context

    @transaction.atomic
    @action(detail=False, methods=['post'])
    def generate_virtual(self, request):
        """
        Create a new virtual debit card linked to one of the user's accounts.
        Returns full sensitive details ONLY in this response.
        Sends the 4-digit PIN via email for secure later access.
        """
        account_id = request.data.get('account')
        daily_limit = Decimal(request.data.get('daily_limit', '50000.00'))
        tx_limit    = Decimal(request.data.get('tx_limit', '20000.00'))

        # Input validation
        if daily_limit < 100:
            return Response({"error": "Daily limit must be at least 100 KES"}, status=400)
        if tx_limit < 50:
            return Response({"error": "Transaction limit must be at least 50 KES"}, status=400)
        if daily_limit > 500000:
            return Response({"error": "Daily limit cannot exceed 500,000 KES"}, status=400)
        if tx_limit > 200000:
            return Response({"error": "Transaction limit cannot exceed 200,000 KES"}, status=400)

        try:
            account = Account.objects.select_for_update().get(
                id=account_id,
                user=request.user,
                is_active=True
            )
        except Account.DoesNotExist:
            return Response({"error": "Account not found or inactive"}, status=404)

        card = Card.objects.create(
            account=account,
            card_type='debit_virtual',
            daily_spend_limit=daily_limit,
            transaction_limit=tx_limit,
        )

        data = self.get_serializer(card).data
        data.update({
            'full_card_number': card.card_number,
            'cvv': card.cvv,
            'pin': card.pin,
        })

        try:
            user = request.user
            send_mail(
                subject="Your New Virtual Card PIN – Spartan Bank",
                message=f"""
Dear {user.first_name or user.email},

Your virtual debit card has been successfully created!

Card ending in: {card.card_number[-4:]}
Expiry: {card.expiry_date.strftime('%m/%y')}
PIN: {card.pin}

⚠️  IMPORTANT – SECURITY NOTICE:
• This 4-digit PIN is ONLY used to view full card details in the app.
• NEVER share this PIN with anyone — not even Spartan Bank staff.
• Treat it the same way you treat your banking passwords.

You can now go to the Cards section → select this card → Reveal Details → enter this PIN.

For your safety, full card number and CVV are shown only once here and never again.

Best regards,
Spartan Bank Team
                """.strip(),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception as email_error:
            print(f"[EMAIL ERROR] Failed to send PIN email to {user.email}: {email_error}")
            data['email_warning'] = "PIN email could not be sent — please screenshot these details"

        return Response({
            "message": "Virtual card created successfully",
            "card": data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='reveal', throttle_classes=[RevealThrottle])
    def reveal_details(self, request, pk=None):
        card = self.get_object()

        provided_pin = str(request.data.get('pin', '')).strip()

        if not provided_pin:
            return Response({"error": "PIN is required"}, status=400)

        if provided_pin != card.pin:
            return Response({"error": "Invalid PIN"}, status=403)

        data = self.get_serializer(card).data
        data.update({
            'full_card_number': card.card_number,
            'cvv': card.cvv,
        })

        return Response({
            "message": "Card details revealed (do not share)",
            "card": data,
            "warning": "This information is sensitive — hide after use"
        })

    @action(detail=True, methods=['post'])
    def freeze(self, request, pk=None):
        card = self.get_object()
        if card.freeze():
            return Response({"message": "Card has been frozen"}, status=200)
        return Response(
            {"error": f"Cannot freeze card in status: {card.get_status_display()}"},
            status=400
        )

    @action(detail=True, methods=['post'])
    def unfreeze(self, request, pk=None):
        card = self.get_object()
        if card.unfreeze():
            return Response({"message": "Card has been unfrozen"}, status=200)
        return Response(
            {"error": f"Cannot unfreeze card in status: {card.get_status_display()}"},
            status=400
        )

    @action(detail=True, methods=['post'])
    def set_limits(self, request, pk=None):
        card = self.get_object()

        daily = Decimal(request.data.get('daily_limit', card.daily_spend_limit))
        tx    = Decimal(request.data.get('transaction_limit', card.transaction_limit))

        if daily < card.used_today:
            return Response(
                {"error": f"New daily limit cannot be below already used amount ({card.used_today})"},
                status=400
            )

        card.daily_spend_limit = daily
        card.transaction_limit = tx
        card.save(update_fields=['daily_spend_limit', 'transaction_limit'])

        return Response({
            "message": "Card limits updated successfully",
            "card": self.get_serializer(card).data
        })

    @action(detail=True, methods=['get'], url_path='transactions')
    def transactions(self, request, pk=None):
        """
        Get recent transactions made with this specific card.
        Returns last 15 transactions ordered by timestamp (newest first).
        """
        card = self.get_object()
        limit = int(request.query_params.get('limit', 15))
        qs = card.transactions.order_by('-timestamp')[:limit]

        serializer = CardTransactionSerializer(qs, many=True)
        return Response({
            "count": qs.count(),
            "results": serializer.data
        })
class GlobalCardTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    List ALL card transactions across all cards belonging to the current user.
    Ordered by timestamp (newest first).
    """
    serializer_class = CardTransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CardTransaction.objects.filter(
            card__account__user=self.request.user
        ).select_related('card').order_by('-timestamp')