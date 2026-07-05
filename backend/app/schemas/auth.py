import re

from pydantic import BaseModel, Field, field_validator


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if not EMAIL_PATTERN.fullmatch(email):
        raise ValueError("Enter a valid email address")
    return email


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)


class VerifyEmailRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    pin: str = Field(..., min_length=6, max_length=6)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)

    @field_validator("pin")
    @classmethod
    def validate_pin(cls, value: str) -> str:
        pin = value.strip()
        if not pin.isdigit():
            raise ValueError("Verification PIN must contain 6 digits")
        return pin


class ResendVerificationRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)


class PasswordResetRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)


class ResetPasswordRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    pin: str = Field(..., min_length=6, max_length=6)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)

    @field_validator("pin")
    @classmethod
    def validate_pin(cls, value: str) -> str:
        pin = value.strip()
        if not pin.isdigit():
            raise ValueError("Reset PIN must contain 6 digits")
        return pin


class UserResponse(BaseModel):
    id: str
    email: str
    is_guest: bool = False
    is_pro: bool = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class RegisterResponse(BaseModel):
    message: str
    email: str
    email_sent: bool = True


class PasswordResetResponse(BaseModel):
    message: str
    email: str
