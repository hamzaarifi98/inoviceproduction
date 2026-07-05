import logging
import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmailDeliveryResult:
    sent: bool
    mode: str


class EmailDeliveryError(Exception):
    pass


def send_verification_pin(email: str, pin: str) -> EmailDeliveryResult:
    return _send_pin_email(
        email=email,
        pin=pin,
        subject="Invoice Pocket verification PIN",
        body=(
            f"Your Invoice Pocket verification PIN is {pin}.\n\n"
            "It expires in 10 minutes."
        ),
        purpose="verification PIN",
    )


def send_password_reset_pin(email: str, pin: str) -> EmailDeliveryResult:
    return _send_pin_email(
        email=email,
        pin=pin,
        subject="Invoice Pocket password reset PIN",
        body=(
            f"Your Invoice Pocket password reset PIN is {pin}.\n\n"
            "It expires in 10 minutes."
        ),
        purpose="password reset PIN",
    )


def _send_pin_email(
    email: str,
    pin: str,
    subject: str,
    body: str,
    purpose: str,
) -> EmailDeliveryResult:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    from_email = os.getenv("SMTP_FROM_EMAIL", smtp_username or "noreply@invoice-pocket.local")
    timeout_seconds = int(os.getenv("SMTP_TIMEOUT_SECONDS", "15"))
    allow_console_email = os.getenv("ALLOW_CONSOLE_EMAIL", "false").lower() in {"1", "true", "yes"}
    use_ssl = os.getenv("SMTP_USE_SSL", "").lower() in {"1", "true", "yes"} or smtp_port == 465
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in {"1", "true", "yes"}

    if not smtp_host:
        if allow_console_email:
            logger.warning("SMTP_HOST is not configured. %s for %s is %s", purpose, email, pin)
            return EmailDeliveryResult(sent=False, mode="console")
        raise EmailDeliveryError("Email delivery is not configured on the server.")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = from_email
    message["To"] = email
    message.set_content(body)

    try:
        smtp_class = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
        with smtp_class(smtp_host, smtp_port, timeout=timeout_seconds) as smtp:
            if use_tls and not use_ssl:
                smtp.starttls()
            if smtp_username and smtp_password:
                smtp.login(smtp_username, smtp_password)
            smtp.send_message(message)
            logger.info("Sent %s to %s through %s:%s", purpose, email, smtp_host, smtp_port)
            return EmailDeliveryResult(sent=True, mode="smtp")
    except (smtplib.SMTPException, OSError) as exc:
        logger.exception("SMTP failed while sending %s to %s", purpose, email)
        raise EmailDeliveryError("Could not send email. Check the server SMTP settings.") from exc
