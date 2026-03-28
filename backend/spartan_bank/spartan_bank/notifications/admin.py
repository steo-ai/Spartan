from django.contrib import admin
from .models import EmailNotificationLog


@admin.register(EmailNotificationLog)
class EmailNotificationLogAdmin(admin.ModelAdmin):
    list_display = ('subject', 'recipient', 'sent_at', 'success', 'user')
    list_filter = ('success', 'sent_at')
    search_fields = ('subject', 'recipient', 'user__email')
    readonly_fields = ('sent_at', 'error_message', 'context_data')
    date_hierarchy = 'sent_at'