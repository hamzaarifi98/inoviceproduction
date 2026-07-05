import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.invoice import Invoice


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        default=uuid.uuid4,
        unique=True,
        index=True,
        nullable=False,
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_guest: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_pro: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_verification_pin_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_verification_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    password_reset_pin_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_reset_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    invoices: Mapped[list["Invoice"]] = relationship(back_populates="user")
