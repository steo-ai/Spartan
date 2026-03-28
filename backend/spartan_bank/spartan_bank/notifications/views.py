# notifications/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import EmailNotificationLog
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ModelViewSet):
    """
    User notifications (currently transaction emails logged as notifications)
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = EmailNotificationLog.objects.filter(user=self.request.user)
        # Optional: only show successful ones by default
        # qs = qs.filter(success=True)
        return qs.order_by('-sent_at')

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_as_read(self, request, pk=None):
        notification = self.get_object()
        if notification.user != request.user:
            return Response({"detail": "Not found"}, status=404)
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response({"message": "Marked as read"})

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_as_read(self, request):
        updated = EmailNotificationLog.objects.filter(
            user=request.user,
            is_read=False
        ).update(is_read=True)
        return Response({
            "message": f"Marked {updated} notifications as read"
        })

    def list(self, request, *args, **kwargs):
        # Optional: add unread count in response headers or extra field
        queryset = self.filter_queryset(self.get_queryset())
        unread_count = queryset.filter(is_read=False).count()

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.headers['X-Unread-Count'] = str(unread_count)
            return response

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            "results": serializer.data,
            "unread_count": unread_count
        })