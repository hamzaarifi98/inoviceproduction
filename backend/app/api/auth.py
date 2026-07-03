import secrets
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
    set_email_verification_pin,
)
from app.models.users import User
from app.schemas.auth import (
    LoginRequest,
    normalize_email,
    RegisterRequest,
    RegisterResponse,
    ResendVerificationRequest,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
)
from app.services.email_service import send_verification_pin


router = APIRouter(
    prefix="/auth",
    tags=["Auth"],
)

VERIFICATION_PIN_EXPIRE_MINUTES = 10


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
        if user is None:
            user = create_user(
                db=db,
                email=email,
                password_hash=hash_password(request.password),
            )
        else:
            user.password_hash = hash_password(request.password)

        pin = _new_verification_pin()
        set_email_verification_pin(
            user=user,
            pin_hash=hash_password(pin),
            expires_at=_verification_expires_at(),
        )
        db.commit()
        db.refresh(user)
        send_verification_pin(email=user.email, pin=pin)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not send verification email",
        )

    return {
        "message": "Verification PIN sent",
        "email": user.email,
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
        pin = _new_verification_pin()
        set_email_verification_pin(
            user=user,
            pin_hash=hash_password(pin),
            expires_at=_verification_expires_at(),
        )
        db.commit()
        send_verification_pin(email=user.email, pin=pin)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not send verification email",
        )

    return {
        "message": "Verification PIN sent",
        "email": user.email,
    }


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


def _new_verification_pin() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _verification_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=VERIFICATION_PIN_EXPIRE_MINUTES)


def _is_expired(expires_at: datetime) -> bool:
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= datetime.now(timezone.utc)
