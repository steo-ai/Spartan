from rest_framework import serializers

from .models import Card, CardTransaction


class CardSerializer(serializers.ModelSerializer):
    masked_number     = serializers.ReadOnlyField()
    masked_cvv        = serializers.ReadOnlyField()
    account_number    = serializers.CharField(source='account.account_number', read_only=True)
    card_type_display = serializers.CharField(source='get_card_type_display', read_only=True)
    status_display    = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Card
        fields = [
            'id',
            'card_type',
            'card_type_display',
            'status',
            'status_display',
            'masked_number',
            'expiry_date',
            'masked_cvv',
            'daily_spend_limit',
            'transaction_limit',
            'used_today',
            'issued_at',
            'last_used',
            'account',
            'account_number',
        ]
        read_only_fields = [
            'masked_number',
            'masked_cvv',
            'issued_at',
            'last_used',
            'used_today',
            'account_number',
            'card_type_display',
            'status_display',
        ]

    def to_representation(self, instance):
        return super().to_representation(instance)


class CardTransactionSerializer(serializers.ModelSerializer):
    merchant_name     = serializers.CharField(allow_blank=True, required=False)
    merchant_category = serializers.CharField(allow_blank=True, required=False)
    reference         = serializers.CharField(allow_blank=True, required=False)

    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        coerce_to_string=True
    )

    timestamp = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S", read_only=True)

    class Meta:
        model = CardTransaction
        fields = [
            'id',
            'card',               # optional – useful for context
            'amount',
            'merchant_name',
            'merchant_category',
            'status',
            'timestamp',
            'reference',
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Optional future additions:
        # ret['amount_formatted'] = f"KES {float(instance.amount):,.2f}"
        return ret