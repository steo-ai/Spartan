from rest_framework import serializers
from .models import Transfer
from accounts.serializers import AccountSerializer


class TransferSerializer(serializers.ModelSerializer):
    sender_account_number = serializers.CharField(source='sender_account.account_number', read_only=True)
    receiver_account_number = serializers.CharField(source='receiver_account.account_number', read_only=True, allow_null=True)
    sender = AccountSerializer(read_only=True)
    receiver = AccountSerializer(read_only=True, allow_null=True)

    class Meta:
        model = Transfer
        fields = [
            'id', 'sender_account', 'sender_account_number', 'sender',
            'receiver_account', 'receiver_account_number', 'receiver',
            'amount', 'fee', 'total_debited', 'transfer_type',
            'status', 'description', 'reference',
            'initiated_at', 'completed_at',
            'external_reference', 'external_provider', 'phone_number'
        ]
        read_only_fields = [
            'fee', 'total_debited', 'status', 'reference',
            'initiated_at', 'completed_at', 'external_reference'
        ]

    def validate(self, data):
        sender = data['sender_account']
        if sender.user != self.context['request'].user:
            raise serializers.ValidationError("You can only transfer from your own accounts.")
        return data