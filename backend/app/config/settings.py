# app/core/config.py

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    AWS_REGION: str = "eu-north-1"
    S3_BUCKET_NAME: str = "amzn-invoiceapp"
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_SESSION_TOKEN: str | None = None
    MAX_INVOICE_FILE_SIZE_MB: int = 5

    class Config:
        env_file = ".env"


settings = Settings()
