import logging
import os
import smtplib
from email.message import EmailMessage


logger = logging.getLogger(__name__)


def send_verification_pin(email: str, pin: str) -> None:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    from_email = os.getenv("SMTP_FROM_EMAIL", smtp_username or "noreply@invoice-pocket.local")
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in {"1", "true", "yes"}

    if not smtp_host:
        logger.warning("SMTP_HOST is not configured. Verification PIN for %s is %s", email, pin)
        return

    message = EmailMessage()
    message["Subject"] = "Invoice Pocket verification PIN"
    message["From"] = from_email
    message["To"] = email
    message.set_content(
        f"Your Invoice Pocket verification PIN is {pin}.\n\n"
        "It expires in 10 minutes."
    )

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as smtp:
            if use_tls:
                smtp.starttls()
            if smtp_username and smtp_password:
                smtp.login(smtp_username, smtp_password)
            smtp.send_message(message)
    except smtplib.SMTPException:
        logger.exception("SMTP failed while sending verification PIN to %s", email)
        raise
    except OSError:
        logger.exception("Could not connect to SMTP server while sending verification PIN to %s", email)
        raise
