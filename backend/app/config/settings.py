# app/core/config.py

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    AWS_REGION: str = "eu-north-1"
    S3_BUCKET_NAME: str = "amzn-invoiceapp"
    MAX_INVOICE_FILE_SIZE_MB: int = 5

    class Config:
        env_file = ".env"


settings = Settings()