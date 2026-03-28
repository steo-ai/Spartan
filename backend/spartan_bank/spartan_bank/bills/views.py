# bills/views.py
from decimal import Decimal, InvalidOperation
from django.db.models import Sum, Count
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.db import transaction as db_transaction
from django.utils import timezone

from .models import BillCategory, BillPayment, AirtimeTopup, AirtimeProvider, DataBundle
from .serializers import (
    BillCategorySerializer,
    BillPaymentSerializer,
    AirtimeProviderSerializer,
    AirtimeTopupSerializer,
    DataBundleSerializer,
)
from accounts.models import Account, UserProfile


class BillCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    List available bill categories (airtime, electricity, etc.)
    """
    queryset = BillCategory.objects.filter(is_active=True)
    serializer_class = BillCategorySerializer
    permission_classes = [IsAuthenticated]


class BillPaymentViewSet(viewsets.ModelViewSet):
    serializer_class = BillPaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            return BillPayment.objects.all()
        return BillPayment.objects.filter(user_account__user=self.request.user)

    @db_transaction.atomic
    @action(detail=False, methods=['post'])
    def pay(self, request):
        """
        Initiate bill payment
        """
        try:
            user_account_id = request.data['user_account']
            category_id = request.data['category']
            paybill = request.data.get('paybill_number', '')
            acc_number = request.data['account_number'].strip()
            amount_str = request.data.get('amount', '0')
            desc = request.data.get('description', '')

            amount = Decimal(amount_str)
            user_account = Account.objects.get(id=user_account_id, user=request.user, is_active=True)
            category = BillCategory.objects.get(id=category_id, is_active=True)
        except (KeyError, InvalidOperation, Account.DoesNotExist, BillCategory.DoesNotExist):
            return Response({"error": "Invalid input or account/category not found"}, status=400)

        if amount < category.min_amount or amount > category.max_amount:
            return Response({
                "error": f"Amount must be between {category.min_amount} and {category.max_amount}"
            }, status=400)

        profile = request.user.userprofile
        fee = Decimal('25.00') if amount > Decimal('5000') else Decimal('10.00')
        total = amount + fee

        if user_account.balance < total:
            return Response({"error": "Insufficient funds"}, status=400)

        used_out = profile.get_daily_used_outflows()
        if used_out + total > profile.daily_outflow_limit:
            remaining = profile.daily_outflow_limit - used_out
            return Response({
                "error": f"Daily outflow limit exceeded. Remaining: {remaining:,.2f}"
            }, status=403)

        payment = BillPayment.objects.create(
            user_account=user_account,
            category=category,
            paybill_number=paybill or category.paybill_number,
            account_number=acc_number,
            amount=amount,
            fee=fee,
            total_debited=total,
            description=desc,
            status='pending'
        )

        success, msg = payment.execute()

        if not success:
            return Response({"error": msg}, status=400)

        user_account.refresh_from_db()

        return Response({
            "message": "Bill payment successful",
            "payment": BillPaymentSerializer(payment, context={'request': request}).data,
            "new_balance": f"{user_account.balance:,.2f}",
            "daily_outflow_remaining": f"{profile.get_remaining_daily_outflows():,.2f}"
        }, status=201)

    @action(detail=True, methods=['get'], permission_classes=[IsAdminUser])
    def admin_check_status(self, request, pk=None):
        payment = self.get_object()
        return Response({
            "status": payment.status,
            "external_reference": payment.external_reference,
            "completed_at": payment.completed_at
        })

    @action(detail=False, methods=['get'])
    def providers(self, request):
        providers = AirtimeProvider.objects.filter(is_active=True)
        return Response(AirtimeProviderSerializer(providers, many=True).data)

    @action(detail=False, methods=['get'])
    def bundles(self, request):
        provider_id = request.query_params.get('provider')
        qs = DataBundle.objects.filter(is_active=True)
        if provider_id:
            qs = qs.filter(provider_id=provider_id)
        return Response(DataBundleSerializer(qs.order_by('amount'), many=True).data)

    @db_transaction.atomic
    @action(detail=False, methods=['post'])
    def topup_airtime(self, request):
        """
        Buy airtime or bundle
        """
        try:
            user_account_id = request.data['user_account']
            provider_id = request.data['provider']
            phone = str(request.data['phone_number']).strip()
            amount_str = request.data.get('amount')
            bundle_id = request.data.get('bundle')
            desc = request.data.get('description', 'Airtime top-up')

            user_account = Account.objects.get(id=user_account_id, user=request.user, is_active=True)
            provider = AirtimeProvider.objects.get(id=provider_id, is_active=True)

            if not phone.startswith('254') or len(phone) != 12:
                raise ValueError("Invalid phone format (use 2547xxxxxxxx)")

            is_bundle = bool(bundle_id)
            if is_bundle:
                bundle = DataBundle.objects.get(id=bundle_id, provider=provider, is_active=True)
                amount = bundle.amount
                desc = f"{bundle.name} bundle for {phone}"
            else:
                amount = Decimal(amount_str)
                if amount < Decimal('5') or amount > Decimal('10000'):
                    raise ValueError("Airtime amount must be KES 5 – 10,000")
                bundle = None

        except (KeyError, InvalidOperation, ValueError, Account.DoesNotExist,
                AirtimeProvider.DoesNotExist, DataBundle.DoesNotExist) as e:
            return Response({"error": str(e)}, status=400)

        profile = request.user.userprofile
        fee = Decimal('0.00')
        total = amount + fee

        if user_account.balance < total:
            return Response({"error": "Insufficient funds"}, status=400)

        used_out = profile.get_daily_used_outflows()
        if used_out + total > profile.daily_outflow_limit:
            remaining = profile.daily_outflow_limit - used_out
            return Response({
                "error": f"Daily outflow limit exceeded. Remaining: {remaining:,.2f}"
            }, status=403)

        topup = AirtimeTopup.objects.create(
            user_account=user_account,
            category=BillCategory.objects.get_or_create(
                slug='airtime',
                defaults={'name': 'Airtime & Bundles'}
            )[0],
            provider=provider,
            phone_number=phone,
            amount=amount,
            fee=fee,
            total_debited=total,
            description=desc,
            status='pending',
            is_bundle=is_bundle,
            bundle=bundle
        )

        success, msg = topup.execute()

        if not success:
            return Response({"error": msg}, status=400)

        user_account.refresh_from_db()

        return Response({
            "message": "Top-up successful",
            "topup": AirtimeTopupSerializer(topup, context={'request': request}).data,
            "new_balance": f"{user_account.balance:,.2f}",
            "daily_outflow_remaining": f"{profile.get_remaining_daily_outflows():,.2f}"
        }, status=201)

    # ==================== FIXED STATS (No Double Counting) ====================
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Monthly quick stats for current user - Fixed (no double counting bundles)"""
        user = request.user
        today = timezone.now().date()
        first_day_this_month = today.replace(day=1)

        # Normal bills only (exclude airtime category)
        bills = BillPayment.objects.filter(
            user_account__user=user,
            status='completed',
            initiated_at__gte=first_day_this_month
        ).exclude(category__slug='airtime').aggregate(
            total_spent=Sum('total_debited'),
            bills_paid=Count('id')
        )

        # Airtime & Bundles (use AirtimeTopup model)
        airtime = AirtimeTopup.objects.filter(
            user_account__user=user,
            status='completed',
            initiated_at__gte=first_day_this_month
        ).aggregate(
            total_spent=Sum('total_debited'),
            bills_paid=Count('id')
        )

        total_spent = (bills['total_spent'] or 0) + (airtime['total_spent'] or 0)
        total_count = (bills['bills_paid'] or 0) + (airtime['bills_paid'] or 0)

        return Response({
            "total_spent": float(total_spent),
            "bills_paid": total_count,
        })

    # ==================== RECENT (Already Working Perfectly) ====================
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Last 5 completed transactions - Fixed to avoid duplicates"""
        user = request.user

        # Prefer AirtimeTopup for airtime/bundle transactions (more descriptive)
        airtime = AirtimeTopup.objects.filter(
            user_account__user=user,
            status='completed'
        ).select_related('provider', 'bundle', 'category').order_by('-completed_at')[:10]

        # Normal bills (exclude airtime category to prevent duplication)
        bills = BillPayment.objects.filter(
            user_account__user=user,
            status='completed'
        ).exclude(category__slug='airtime') \
         .select_related('category').order_by('-completed_at')[:10]

        all_items = list(airtime) + list(bills)
        all_items.sort(key=lambda x: x.completed_at or x.initiated_at, reverse=True)

        recent = all_items[:5]

        data = []
        for item in recent:
            if isinstance(item, AirtimeTopup):
                if item.is_bundle and item.bundle:
                    desc = f"{item.bundle.name} for {item.phone_number}"
                else:
                    desc = f"{item.provider.name} Airtime to {item.phone_number}"
            else:
                desc = item.description or f"{item.category.name} payment"

            data.append({
                "id": item.id,
                "description": desc,
                "amount": float(-item.total_debited),
                "date": item.completed_at or item.initiated_at,
            })

        return Response(data)


class AirtimeProviderViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AirtimeProvider.objects.all()
    serializer_class = AirtimeProviderSerializer
    permission_classes = [IsAuthenticated]


class DataBundleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DataBundle.objects.filter(is_active=True)
    serializer_class = DataBundleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        provider_id = self.request.query_params.get('provider')
        if provider_id:
            try:
                qs = qs.filter(provider_id=int(provider_id))
            except ValueError:
                pass
        return qs