# notifications/models.py
from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal


class EmailNotificationLog(models.Model):
    """
    Log of sent emails + basic in-app notification support
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications'
    )
    subject = models.CharField(max_length=255)
    recipient = models.EmailField()
    sent_at = models.DateTimeField(default=timezone.now)
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)
    context_data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)               # ← NEW: for in-app read status

    class Meta:
        ordering = ['-sent_at']
        verbose_name = "Notification Log"
        verbose_name_plural = "Notification Logs"

    def __str__(self):
        return f"{self.subject} → {self.recipient} ({self.sent_at.date()})"

    # ─── Computed properties for frontend ────────────────────────────────────────

    @property
    def notification_type(self) -> str:
        ctx = self.context_data or {}
        t = ctx.get("type", "").lower()
        if "transaction" in t or "transfer" in t or "payment" in t:
            return "transaction"
        if "security" in t or "login" in t or "device" in t or "mfa" in t:
            return "security"
        if "promo" in t or "offer" in t or "bonus" in t:
            return "promo"
        if "alert" in t or "warning" in t or "suspicious" in t:
            return "alert"
        return "info"

    @property
    def title(self) -> str:
        return self.subject.replace("Spartan Bank: ", "").strip()

    @property
    def short_message(self) -> str:
        # Try to get a clean short message from context
        ctx = self.context_data or {}
        if "plain_message" in ctx:
            return ctx["plain_message"][:160]
        if "message" in ctx:
            return ctx["message"][:160]
        return self.subject

    @property
    def amount(self) -> float | None:
        try:
            return float(self.context_data.get("amount", None))
        except (TypeError, ValueError):
            return None

    @property
    def direction(self) -> str | None:
        amt = self.amount
        if amt is None:
            return None
        return "in" if amt > 0 else "out"