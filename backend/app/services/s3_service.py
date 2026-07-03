from functools import lru_cache
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config.settings import settings


@lru_cache
def get_s3_client():
    session_kwargs = {}
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        session_kwargs = {
            "aws_access_key_id": settings.AWS_ACCESS_KEY_ID,
            "aws_secret_access_key": settings.AWS_SECRET_ACCESS_KEY,
            "aws_session_token": settings.AWS_SESSION_TOKEN,
        }

    session = boto3.Session(**session_kwargs)
    if session.get_credentials() is None:
        raise RuntimeError(
            "AWS credentials are missing. Set AWS_ACCESS_KEY_ID and "
            "AWS_SECRET_ACCESS_KEY in the backend environment."
        )

    return session.client(
        "s3",
        region_name=settings.AWS_REGION,
        endpoint_url=f"https://s3.{settings.AWS_REGION}.amazonaws.com",
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "virtual"},
        ),
    )


def get_max_file_size_bytes() -> int:
    return settings.MAX_INVOICE_FILE_SIZE_MB * 1024 * 1024


def create_presigned_post(
    s3_key: str,
    content_type: str,
) -> dict:
    """
    Our wrapper around boto3's real method:
    s3.generate_presigned_post(...)
    """

    s3 = get_s3_client()

    max_size_bytes = get_max_file_size_bytes()
    expires_in_seconds = 300

    presigned_post = s3.generate_presigned_post(
        Bucket=settings.S3_BUCKET_NAME,
        Key=s3_key,
        Fields={
            "Content-Type": content_type,
            "x-amz-server-side-encryption": "AES256",
        },
        Conditions=[
            {"Content-Type": content_type},
            {"x-amz-server-side-encryption": "AES256"},
            ["content-length-range", 1, max_size_bytes],
        ],
        ExpiresIn=expires_in_seconds,
    )

    return {
        "upload_url": presigned_post["url"],
        "fields": presigned_post["fields"],
        "max_size_bytes": max_size_bytes,
        "expires_in_seconds": expires_in_seconds,
    }


def get_s3_object_metadata(s3_key: str) -> dict | None:
    s3 = get_s3_client()

    try:
        response = s3.head_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=s3_key,
        )

        return {
            "content_length": response.get("ContentLength"),
            "content_type": response.get("ContentType"),
            "etag": response.get("ETag"),
            "last_modified": response.get("LastModified"),
        }

    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")

        if error_code in {"404", "NoSuchKey", "NotFound"}:
            return None

        raise


def upload_s3_object_bytes(
    s3_key: str,
    content: bytes,
    content_type: str,
) -> None:
    s3 = get_s3_client()

    s3.put_object(
        Bucket=settings.S3_BUCKET_NAME,
        Key=s3_key,
        Body=content,
        ContentType=content_type,
        ServerSideEncryption="AES256",
    )


def get_s3_object_prefix_bytes(
    s3_key: str,
    byte_count: int = 16,
) -> bytes:
    s3 = get_s3_client()

    response = s3.get_object(
        Bucket=settings.S3_BUCKET_NAME,
        Key=s3_key,
        Range=f"bytes=0-{byte_count - 1}",
    )
    return response["Body"].read()


def download_s3_object_to_file(
    s3_key: str,
    destination_path: str | Path,
) -> None:
    s3 = get_s3_client()

    s3.download_file(
        Bucket=settings.S3_BUCKET_NAME,
        Key=s3_key,
        Filename=str(destination_path),
    )
