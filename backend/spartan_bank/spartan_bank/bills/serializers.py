# bills/serializers.py
from rest_framework import serializers

from .models import BillCategory, BillPayment, AirtimeProvider, AirtimeTopup, DataBundle
from payments.serializers import TransferSerializer
from accounts.serializers import AccountSerializer


class BillCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = BillCategory
        fields = [
            'id', 'name', 'slug', 'paybill_number', 'account_number_label',
            'min_amount', 'max_amount', 'icon_class', 'is_active'
        ]


class BillPaymentSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    account_number_masked = serializers.SerializerMethodField()
    transfer = TransferSerializer(read_only=True)
    from_account = AccountSerializer(source='user_account', read_only=True)

    class Meta:
        model = BillPayment
        fields = [
            'id', 'category', 'category_name', 'user_account', 'from_account',
            'paybill_number', 'account_number', 'account_number_masked',
            'amount', 'fee', 'total_debited', 'status', 'description',
            'reference', 'external_reference', 'initiated_at', 'completed_at',
            'transfer'
        ]
        read_only_fields = [
            'fee', 'total_debited', 'status', 'reference', 'external_reference',
            'initiated_at', 'completed_at', 'transfer'
        ]

    def get_account_number_masked(self, obj):
        if len(obj.account_number) > 6:
            return f"{obj.account_number[:3]}...{obj.account_number[-3:]}"
        return obj.account_number

    def validate(self, data):
        request = self.context['request']
        account = data['user_account']
        if account.user != request.user:
            raise serializers.ValidationError("You can only pay bills from your own accounts.")
        return data


class AirtimeProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = AirtimeProvider
        fields = ['id', 'name', 'short_name', 'default_paybill']


class DataBundleSerializer(serializers.ModelSerializer):
    provider_name = serializers.CharField(source='provider.name', read_only=True)

    class Meta:
        model = DataBundle
        fields = [
            'id', 'provider', 'provider_name', 'name', 'code',
            'amount', 'data_amount', 'validity_days', 'is_popular'
        ]


class AirtimeTopupSerializer(BillPaymentSerializer):
    """
    Serializer for AirtimeTopup (inherits from BillPaymentSerializer)
    """
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    bundle_name = serializers.CharField(source='bundle.name', read_only=True, allow_null=True)

    class Meta(BillPaymentSerializer.Meta):
        model = AirtimeTopup
        fields = BillPaymentSerializer.Meta.fields + [
            'provider', 'provider_name', 'phone_number',
            'is_bundle', 'bundle', 'bundle_name'
        ]

    def to_representation(self, instance):
        """
        Customize representation to clearly show it's an airtime top-up
        and include extra useful fields.
        """
        data = super().to_representation(instance)

        # Add airtime-specific fields for frontend clarity
        data['is_airtime_topup'] = True
        data['phone_number'] = instance.phone_number
        if instance.is_bundle and instance.bundle:
            data['bundle_name'] = instance.bundle.name
            data['data_amount'] = instance.bundle.data_amount
            data['validity_days'] = instance.bundle.validity_days

        return data