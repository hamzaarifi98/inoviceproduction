import secrets
import logging
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rate_limit import enforce_rate_limit
from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.crud.users import (
    create_user,
    get_user_by_email,
    mark_email_verified,
    set_password_hash,
    set_password_reset_pin,
    set_email_verification_pin,
)
from app.models.users import User
from app.schemas.auth import (
    LoginRequest,
    normalize_email,
    PasswordResetRequest,
    PasswordResetResponse,
    RegisterRequest,
    RegisterResponse,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
)
from app.services.email_service import (
    EmailDeliveryError,
    EmailDeliveryResult,
    send_password_reset_pin,
    send_verification_pin,
)


router = APIRouter(
    prefix="/auth",
    tags=["Auth"],
)

VERIFICATION_PIN_EXPIRE_MINUTES = 10
PASSWORD_RESET_PIN_EXPIRE_MINUTES = 10
logger = logging.getLogger(__name__)


@router.post(
    "/guest",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_guest_session(
    http_request: Request,
    db: Session = Depends(get_db),
):
    client_host = http_request.client.host if http_request.client else "unknown"
    enforce_rate_limit(http_request, "guest", client_host, max_attempts=10)

    guest_id = uuid4()
    user = create_user(
        db=db,
        email=f"guest-{guest_id}@guest.invoice-pocket.local",
        password_hash=hash_password(secrets.token_urlsafe(32)),
        is_email_verified=True,
        is_guest=True,
        is_pro=False,
    )
    db.commit()
    db.refresh(user)

    return _token_response(user)


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    http_request: Request,
    request: RegisterRequest,
    db: Session = Depends(get_db),
):
    email = request.email
    enforce_rate_limit(http_request, "register", email, max_attempts=5)

    user = get_user_by_email(db=db, email=email)
    if user and user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    try:
        user = _prepare_unverified_user(
            db=db,
            existing_user=user,
            email=email,
            password=request.password,
        )
        pin = _new_pin()
        set_email_verification_pin(
            user=user,
            pin_hash=hash_password(pin),
            expires_at=_pin_expires_at(VERIFICATION_PIN_EXPIRE_MINUTES),
        )
        db.flush()
        delivery = send_verification_pin(email=user.email, pin=pin)
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )
    except EmailDeliveryError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except Exception:
        db.rollback()
        logger.exception("Could not register user %s", email)
        raise HTTPException(status_code=500, detail="Could not create account")

    return {
        "message": _pin_delivery_message("Verification PIN", delivery),
        "email": user.email,
        "email_sent": delivery.sent,
    }


@router.post(
    "/verify-email",
    response_model=TokenResponse,
)
def verify_email(
    http_request: Request,
    request: VerifyEmailRequest,
    db: Session = Depends(get_db),
):
    email = request.email
    enforce_rate_limit(http_request, "verify-email", email, max_attempts=8)

    user = get_user_by_email(db=db, email=email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.is_email_verified:
        return _token_response(user)

    if not user.email_verification_pin_hash or not user.email_verification_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification PIN was not requested",
        )

    if _is_expired(user.email_verification_expires_at):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification PIN expired",
        )

    if not verify_password(request.pin, user.email_verification_pin_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification PIN",
        )

    mark_email_verified(user)
    db.commit()
    db.refresh(user)

    return _token_response(user)


@router.post(
    "/resend-verification",
    response_model=RegisterResponse,
)
def resend_verification(
    http_request: Request,
    request: ResendVerificationRequest,
    db: Session = Depends(get_db),
):
    email = request.email
    enforce_rate_limit(http_request, "resend-verification", email, max_attempts=3)

    user = get_user_by_email(db=db, email=email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already verified",
        )

    try:
        pin = _new_pin()
        set_email_verification_pin(
            user=user,
            pin_hash=hash_password(pin),
            expires_at=_pin_expires_at(VERIFICATION_PIN_EXPIRE_MINUTES),
        )
        db.flush()
        delivery = send_verification_pin(email=user.email, pin=pin)
        db.commit()
    except EmailDeliveryError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except Exception:
        db.rollback()
        logger.exception("Could not resend verification PIN to %s", email)
        raise HTTPException(status_code=500, detail="Could not resend verification PIN")

    return {
        "message": _pin_delivery_message("Verification PIN", delivery),
        "email": user.email,
        "email_sent": delivery.sent,
    }


@router.post(
    "/request-password-reset",
    response_model=PasswordResetResponse,
)
def request_password_reset(
    http_request: Request,
    request: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    email = request.email
    enforce_rate_limit(http_request, "request-password-reset", email, max_attempts=5)

    user = get_user_by_email(db=db, email=email)
    if user is None or user.is_guest:
        return _password_reset_response(email)

    try:
        pin = _new_pin()
        set_password_reset_pin(
            user=user,
            pin_hash=hash_password(pin),
            expires_at=_pin_expires_at(PASSWORD_RESET_PIN_EXPIRE_MINUTES),
        )
        db.flush()
        send_password_reset_pin(email=user.email, pin=pin)
        db.commit()
    except EmailDeliveryError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except Exception:
        db.rollback()
        logger.exception("Could not request password reset for %s", email)
        raise HTTPException(status_code=500, detail="Could not request password reset")

    return _password_reset_response(user.email)


@router.post(
    "/reset-password",
    response_model=TokenResponse,
)
def reset_password(
    http_request: Request,
    request: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    email = request.email
    enforce_rate_limit(http_request, "reset-password", email, max_attempts=8)

    user = get_user_by_email(db=db, email=email)
    if user is None or user.is_guest:
        raise _invalid_reset_pin_error()

    if not user.password_reset_pin_hash or not user.password_reset_expires_at:
        raise _invalid_reset_pin_error()

    if _is_expired(user.password_reset_expires_at):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset PIN expired",
        )

    if not verify_password(request.pin, user.password_reset_pin_hash):
        raise _invalid_reset_pin_error()

    set_password_hash(user, hash_password(request.password))
    mark_email_verified(user)
    db.commit()
    db.refresh(user)

    return _token_response(user)


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    http_request: Request,
    request: LoginRequest,
    db: Session = Depends(get_db),
):
    email = request.email
    enforce_rate_limit(http_request, "login", email)

    user = _authenticate_user(
        db=db,
        email=email,
        password=request.password,
    )
    return _token_response(user)


@router.post(
    "/token",
    response_model=TokenResponse,
)
def token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    try:
        email = normalize_email(form_data.username)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter a valid email address",
        )
    enforce_rate_limit(request, "login", email)

    user = _authenticate_user(
        db=db,
        email=email,
        password=form_data.password,
    )
    return _token_response(user)


@router.get(
    "/me",
    response_model=UserResponse,
)
def me(
    current_user: User = Depends(get_current_user),
):
    return current_user


def _token_response(user: User) -> dict:
    return {
        "access_token": create_access_token(user),
        "token_type": "bearer",
        "user": {
            "id": str(user.public_id),
            "email": user.email,
            "is_guest": user.is_guest,
            "is_pro": user.is_pro,
        },
    }


def _authenticate_user(
    db: Session,
    email: str,
    password: str,
) -> User:
    user = get_user_by_email(db=db, email=email)

    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email is not verified",
        )

    return user


def _prepare_unverified_user(
    db: Session,
    existing_user: User | None,
    email: str,
    password: str,
) -> User:
    if existing_user is None:
        return create_user(
            db=db,
            email=email,
            password_hash=hash_password(password),
        )

    existing_user.password_hash = hash_password(password)
    return existing_user


def _new_pin() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _pin_expires_at(minutes: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


def _pin_delivery_message(
    label: str,
    delivery: EmailDeliveryResult,
) -> str:
    if delivery.sent:
        return f"{label} sent"
    return f"{label} generated. Check the server logs."


def _password_reset_response(email: str) -> dict:
    return {
        "message": "If an account exists for this email, a password reset PIN was sent.",
        "email": email,
    }


def _invalid_reset_pin_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid password reset PIN",
    )


def _is_expired(expires_at: datetime) -> bool:
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= datetime.now(timezone.utc)
