from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.users import User


def get_user_by_id(
    db: Session,
    user_id: int,
) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_public_id(
    db: Session,
    public_id: UUID,
) -> User | None:
    return db.query(User).filter(User.public_id == public_id).first()


def get_user_by_email(
    db: Session,
    email: str,
) -> User | None:
    return db.query(User).filter(User.email == email.lower()).first()


def create_user(
    db: Session,
    email: str,
    password_hash: str,
    *,
    is_email_verified: bool = False,
    is_guest: bool = False,
    is_pro: bool = False,
) -> User:
    user = User(
        email=email.lower(),
        password_hash=password_hash,
        is_email_verified=is_email_verified,
        is_guest=is_guest,
        is_pro=is_pro,
    )
    db.add(user)
    db.flush()
    return user


def set_email_verification_pin(
    user: User,
    pin_hash: str,
    expires_at: datetime,
) -> None:
    user.email_verification_pin_hash = pin_hash
    user.email_verification_expires_at = expires_at


def mark_email_verified(user: User) -> None:
    user.is_email_verified = True
    user.email_verification_pin_hash = None
    user.email_verification_expires_at = None
