# payments/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
from .models import Transfer


@receiver(post_save, sender=Transfer)
def send_transaction_email(sender, instance: Transfer, created: bool, **kwargs):
    """
    Send email notification to the user whenever a Transfer record changes status
    or is created (especially for completed transactions).
    """
    # Only send email when the transaction reaches a final/important state
    if instance.status not in ['completed', 'failed', 'mpesa_confirmed', 'cancelled']:
        return

    # Get the user (from sender_account for most cases)
    user = instance.sender_account.user if instance.sender_account else None
    if not user or not user.email:
        return  # No user or no email → skip silently

    # Determine transaction type for friendly subject & message
    transfer_type_display = instance.get_transfer_type_display() or "Transaction"

    subject = f"Spartan Bank: {transfer_type_display} - {instance.get_status_display()}"

    # Context for email template
    context = {
        'user': user,
        'transfer': instance,
        'amount': f"KES {instance.amount:,.2f}",
        'status': instance.get_status_display(),
        'reference': instance.reference,
        'type': transfer_type_display,
        'description': instance.description or "No description provided",
        'date': instance.completed_at or instance.initiated_at,
        'external_reference': instance.external_reference,
    }

    # Render HTML email
    html_message = render_to_string('emails/transaction_notification.html', context)
    plain_message = strip_tags(html_message)

    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
    except Exception as e:
        # Log error but don't break the transaction
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to send transaction email for {instance.reference}: {str(e)}")