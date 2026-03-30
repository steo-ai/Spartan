# bills/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
import logging

from .models import BillPayment, AirtimeTopup

logger = logging.getLogger(__name__)


@receiver(post_save, sender=BillPayment)
def send_bill_payment_email(sender, instance: BillPayment, created: bool, **kwargs):
    """Send email when a bill payment status changes to completed or failed"""
    if instance.status not in ['completed', 'failed', 'cancelled']:
        return

    user = instance.user_account.user if instance.user_account else None
    if not user or not user.email:
        return

    is_airtime = isinstance(instance, AirtimeTopup)

    if is_airtime:
        subject = f"Spartan Bank: Airtime Top-up - {instance.get_status_display()}"
        transaction_type = "Airtime Top-up"
    else:
        subject = f"Spartan Bank: Bill Payment - {instance.get_status_display()}"
        transaction_type = instance.category.name if instance.category else "Bill Payment"

    context = {
        'user': user,
        'payment': instance,
        'amount': f"KES {instance.total_debited:,.2f}",
        'status': instance.get_status_display(),
        'reference': instance.reference,
        'type': transaction_type,
        'description': instance.description or "No description",
        'date': instance.completed_at or instance.initiated_at,
        'external_reference': instance.external_reference,
        'is_airtime': is_airtime,
        'phone_number': getattr(instance, 'phone_number', None) if is_airtime else None,
    }

    try:
        html_message = render_to_string('emails/bill_payment_notification.html', context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
    except Exception as e:
        logger.error(f"Failed to send bill payment email for {instance.reference}: {str(e)}")


# Connect AirtimeTopup to the same signal handler (since it inherits from BillPayment)
@receiver(post_save, sender=AirtimeTopup)
def send_airtime_topup_email(sender, instance: AirtimeTopup, created: bool, **kwargs):
    send_bill_payment_email(sender, instance, created, **kwargs)