# notifications/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils import timezone
from decimal import Decimal

from accounts.models import Transaction, LoanApplication
from payments.models import Transfer
from notifications.models import EmailNotificationLog


# ────────────────────────────────────────────────────────────────
# HELPER: Send notification from Transaction
# ────────────────────────────────────────────────────────────────
def send_transaction_notification(instance):
    """Central helper to send email + log notification from a Transaction"""
    if instance.amount == Decimal('0.00'):
        return

    user = instance.account.user
    user_name = user.get_full_name() or user.email.split('@')[0].capitalize()

    transaction_type_display = getattr(
        instance, 'get_transaction_type_display', lambda: instance.transaction_type
    )()

    amount_abs = abs(instance.amount)
    sign = "Credit" if instance.amount > 0 else "Debit"

    # ────── Custom subjects and messages per type ──────
    if instance.transaction_type == 'deposit':
        subject = f"Spartan Bank: Deposit Completed Successfully - KES {amount_abs:,.2f}"
        title = "Deposit Completed"
        short_message = f"Your deposit of KES {amount_abs:,.2f} has been approved and credited to your account."

    elif instance.transaction_type == 'withdraw':
        subject = f"Spartan Bank: Withdrawal Completed - KES {amount_abs:,.2f}"
        title = "Withdrawal Completed"
        short_message = f"Your withdrawal of KES {amount_abs:,.2f} has been processed successfully."

    elif instance.transaction_type in ['transfer_out', 'transfer_in']:
        subject = f"Spartan Bank: Transfer {sign} - KES {amount_abs:,.2f}"
        title = f"Transfer {sign}"
        short_message = f"Transfer of KES {amount_abs:,.2f} completed."

    elif instance.transaction_type == 'bill_payment':
        subject = f"Spartan Bank: Bill Payment Successful - KES {amount_abs:,.2f}"
        title = "Bill Payment Completed"
        short_message = f"Your bill payment of KES {amount_abs:,.2f} was successful."

    elif instance.transaction_type in ['airtime_topup', 'airtime']:
        subject = f"Spartan Bank: Airtime Top-up Successful - KES {amount_abs:,.2f}"
        title = "Airtime Top-up Completed"
        short_message = f"Your airtime top-up of KES {amount_abs:,.2f} has been successfully processed."

    elif instance.transaction_type == 'card_purchase':
        subject = f"Spartan Bank: Card Payment - KES {amount_abs:,.2f}"
        title = "Card Purchase"
        short_message = f"Payment of KES {amount_abs:,.2f} was made using your debit card."

    elif instance.transaction_type == 'loan_disbursement':
        subject = f"Spartan Bank: Loan Disbursed - KES {amount_abs:,.2f}"
        title = "Loan Received"
        short_message = f"Loan of KES {amount_abs:,.2f} has been successfully credited to your account."

    elif instance.transaction_type == 'loan_repayment':
        subject = f"Spartan Bank: Loan Repayment Successful - KES {amount_abs:,.2f}"
        title = "Loan Repayment"
        short_message = f"Your loan repayment of KES {amount_abs:,.2f} has been processed successfully."

    else:
        subject = f"Spartan Bank: {transaction_type_display} {sign} - KES {amount_abs:,.2f}"
        title = transaction_type_display
        short_message = f"{transaction_type_display} of KES {amount_abs:,.2f} processed."

    # Context for HTML email template
    context = {
        'user_name': user_name,
        'user_email': user.email,
        'transaction': instance,
        'account_last4': str(getattr(instance.account, 'account_number', 'XXXX'))[-4:],
        'year': timezone.now().year,
        'transaction_type_display': transaction_type_display,
        'title': title,
        'short_message': short_message,
    }

    try:
        html_message = render_to_string(
            'notifications/transaction_notification.html',
            context
        )

        plain_message = (
            f"{title}\n\n"
            f"{short_message}\n"
            f"New balance: {instance.balance_after:,.2f} KES\n"
            f"Reference: {instance.description or '—'}\n"
            f"Date: {instance.timestamp.strftime('%Y-%m-%d %H:%M EAT')}\n\n"
            f"View full details in the Spartan Bank app."
        )

        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=True,
        )

        # Log successful notification
        EmailNotificationLog.objects.create(
            user=user,
            subject=subject,
            recipient=user.email,
            success=True,
            context_data={
                "transaction_id": instance.id,
                "amount": str(instance.amount),
                "type": instance.transaction_type,
                "display_type": transaction_type_display,
                "title": title,
                "short_message": short_message,
            }
        )

    except Exception as e:
        # Log failure but don't break the flow
        EmailNotificationLog.objects.create(
            user=user,
            subject=subject,
            recipient=user.email,
            success=False,
            error_message=str(e),
            context_data={
                "transaction_id": instance.id,
                "amount": str(instance.amount),
                "type": instance.transaction_type,
                "display_type": transaction_type_display,
                "title": title,
                "short_message": short_message,
            }
        )


# ────────────────────────────────────────────────────────────────
# LOAN-SPECIFIC NOTIFICATION HELPER
# ────────────────────────────────────────────────────────────────
def send_loan_notification(instance: LoanApplication, event: str):
    """Professional notifications for loan lifecycle"""
    user = instance.account.user
    user_name = user.get_full_name() or user.email.split('@')[0].capitalize()

    if event == "applied":
        subject = f"Spartan Bank: Loan Application #{instance.id} Received"
        title = "Loan Application Submitted"
        short_message = (
            f"Your loan application for KES {instance.amount_requested:,.2f} "
            f"has been received and is under review. We will notify you once a decision is made."
        )
        context_type = "loan_application"

    elif event == "approved":
        subject = f"Spartan Bank: Loan #{instance.id} Approved & Disbursed"
        title = "Loan Disbursed"
        short_message = (
            f"Your loan of KES {instance.amount_disbursed:,.2f} has been approved and credited to your account."
        )
        context_type = "loan_disbursement"

    elif event == "repayment":
        subject = f"Spartan Bank: Loan Repayment Successful - Loan #{instance.id}"
        title = "Loan Repayment"
        short_message = f"Your loan repayment of KES {instance.total_repaid:,.2f} has been successfully processed."
        context_type = "loan_repayment"

    else:
        return

    context = {
        'user_name': user_name,
        'user_email': user.email,
        'loan': instance,
        'title': title,
        'short_message': short_message,
        'year': timezone.now().year,
    }

    try:
        html_message = render_to_string(
            'notifications/loan_notification.html',
            context
        )
        plain_message = f"{title}\n\n{short_message}\n\nView full details in your Spartan Bank account."

        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=True,
        )

        EmailNotificationLog.objects.create(
            user=user,
            subject=subject,
            recipient=user.email,
            success=True,
            context_data={
                "loan_id": instance.id,
                "amount": str(instance.amount_disbursed or instance.amount_requested),
                "type": context_type,
                "title": title,
                "short_message": short_message,
            }
        )

    except Exception as e:
        EmailNotificationLog.objects.create(
            user=user,
            subject=subject,
            recipient=user.email,
            success=False,
            error_message=str(e),
            context_data={"loan_id": instance.id, "type": context_type}
        )


# ────────────────────────────────────────────────────────────────
# SIGNALS
# ────────────────────────────────────────────────────────────────

@receiver(post_save, sender=Transaction)
def send_transaction_email_notification(sender, instance, created, **kwargs):
    if not created:
        return
    send_transaction_notification(instance)


@receiver(post_save, sender=Transfer)
def notify_on_transfer_completion(sender, instance, created, **kwargs):
    """Trigger notification when a Transfer is marked as completed"""
    if created or instance.status != 'completed':
        return

    # Prevent duplicate notifications if a Transaction already exists
    if Transaction.objects.filter(description__icontains=instance.reference).exists():
        return

    try:
        Transaction.objects.create(
            account=instance.sender_account,
            amount=-instance.total_debited if instance.transfer_type in ['withdraw_mpesa', 'bill_payment'] else instance.amount,
            transaction_type=instance.transfer_type.replace('_', '_') or 'transfer',
            description=instance.description or f"{instance.get_transfer_type_display()} - Ref: {instance.reference}",
            balance_after=instance.sender_account.balance,
            related_account=instance.receiver_account,
        )
    except Exception:
        pass


@receiver(post_save, sender=LoanApplication)
def notify_on_loan_application(sender, instance, created, **kwargs):
    """Send notification when a new loan application is submitted"""
    if created and instance.status == 'pending':
        send_loan_notification(instance, "applied")