# notifications/serializers.py
from rest_framework import serializers
from .models import EmailNotificationLog


class NotificationSerializer(serializers.ModelSerializer):
    type          = serializers.CharField(source='notification_type', read_only=True)
    title         = serializers.CharField(read_only=True)
    message       = serializers.CharField(source='short_message', read_only=True)
    timestamp     = serializers.DateTimeField(source='sent_at', read_only=True)
    
    # These two lines were wrong — remove source= when name matches
    amount        = serializers.FloatField(read_only=True, allow_null=True)
    direction     = serializers.CharField(read_only=True, allow_null=True)
    
    is_read       = serializers.BooleanField()

    class Meta:
        model = EmailNotificationLog
        fields = [
            'id',
            'type',
            'title',
            'message',
            'timestamp',
            'amount',
            'direction',
            'is_read',
            'success',  # optional
        ]
        read_only_fields = [
            'id', 'type', 'title', 'message', 'timestamp',
            'amount', 'direction', 'success'
        ]