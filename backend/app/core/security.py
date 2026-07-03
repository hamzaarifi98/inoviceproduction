import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud.users import get_user_by_public_id
from app.models.users import User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

APP_ENV = os.getenv("APP_ENV", "development").lower()
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    if APP_ENV not in {"local", "development", "test"}:
        raise RuntimeError("JWT_SECRET_KEY must be set outside development")
    JWT_SECRET_KEY = "dev-secret-change-me"
elif JWT_SECRET_KEY == "dev-secret-change-me" and APP_ENV not in {"local", "development", "test"}:
    raise RuntimeError("JWT_SECRET_KEY must not use the development default")

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
PASSWORD_HASH_ITERATIONS = 390000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_HASH_ITERATIONS,
    )
    return (
        f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}$"
        f"{_base64url_encode(salt)}${_base64url_encode(password_hash)}"
    )


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected_hash = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False

        calculated_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            _base64url_decode(salt),
            int(iterations),
        )

        return hmac.compare_digest(
            _base64url_encode(calculated_hash),
            expected_hash,
        )
    except Exception:
        return False


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.public_id),
        "email": user.email,
        "is_guest": user.is_guest,
        "is_pro": user.is_pro,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()),
    }

    return _encode_jwt(payload)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = _decode_jwt(token)
        public_id = UUID(payload["sub"])
    except Exception:
        raise credentials_error

    user = get_user_by_public_id(db=db, public_id=public_id)
    if user is None:
        raise credentials_error

    return user


def _encode_jwt(payload: dict[str, Any]) -> str:
    header = {
        "alg": JWT_ALGORITHM,
        "typ": "JWT",
    }

    signing_input = ".".join(
        [
            _base64url_encode_json(header),
            _base64url_encode_json(payload),
        ]
    )
    signature = _sign(signing_input)
    return f"{signing_input}.{signature}"


def _decode_jwt(token: str) -> dict[str, Any]:
    header_part, payload_part, signature = token.split(".", 2)
    signing_input = f"{header_part}.{payload_part}"

    if not hmac.compare_digest(_sign(signing_input), signature):
        raise ValueError("Invalid token signature")

    header = json.loads(_base64url_decode(header_part))
    if header.get("alg") != JWT_ALGORITHM:
        raise ValueError("Invalid token algorithm")

    payload = json.loads(_base64url_decode(payload_part))
    expires_at = payload.get("exp")

    if not isinstance(expires_at, int):
        raise ValueError("Token expiration is missing")

    if datetime.now(timezone.utc).timestamp() > expires_at:
        raise ValueError("Token expired")

    return payload


def _sign(signing_input: str) -> str:
    signature = hmac.new(
        JWT_SECRET_KEY.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return _base64url_encode(signature)


def _base64url_encode_json(value: dict[str, Any]) -> str:
    return _base64url_encode(
        json.dumps(value, separators=(",", ":")).encode("utf-8")
    )


def _base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)
