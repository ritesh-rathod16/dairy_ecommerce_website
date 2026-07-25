"""
Sends order/account emails.

If SMTP_HOST / SMTP_EMAIL / SMTP_PASSWORD are set in .env, this sends a real
email. If they're not set (the default for local dev), it logs the email to
the console instead of pretending to send it — so you always know whether a
real message went out.
"""
import smtplib
import logging
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger("katlkar.email")
logging.basicConfig(level=logging.INFO)


def _smtp_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_email and settings.smtp_password)


def send_email(to: str, subject: str, body: str) -> bool:
    if not _smtp_configured():
        logger.info("[DEV EMAIL — SMTP not configured, not actually sent]\nTo: %s\nSubject: %s\n%s", to, subject, body)
        return False

    msg = EmailMessage()
    msg["From"] = settings.smtp_email
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_email, settings.smtp_password)
            server.send_message(msg)
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to)
        return False


def notify_order_placed(user_email: str, order_number: str, total: float):
    send_email(
        user_email,
        f"Order confirmed — #{order_number}",
        f"Thanks for your order! #{order_number} has been placed for ₹{total}. "
        "We'll notify you as it moves through packing and delivery.",
    )


def notify_order_status_changed(user_email: str, order_number: str, status: str):
    status_label = status.replace("_", " ").title()
    send_email(
        user_email,
        f"Order #{order_number} — {status_label}",
        f"Your order #{order_number} is now: {status_label}.",
    )
