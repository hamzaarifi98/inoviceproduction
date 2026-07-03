import boto3

s3 = boto3.client("s3", region_name="eu-north-1")

s3.put_object(
    Bucket="amzn-invoiceapp",
    Key="invoices/test/test.txt",
    Body=b"hello from invoice app",
    ContentType="text/plain",
    ServerSideEncryption="AES256",
)

print("Uploaded successfully")