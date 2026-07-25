from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
import base64


def b64url(data):
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


private_key = ec.generate_private_key(ec.SECP256R1())

private_numbers = private_key.private_numbers()

private_bytes = private_numbers.private_value.to_bytes(32, "big")

public_bytes = private_key.public_key().public_bytes(
    serialization.Encoding.X962,
    serialization.PublicFormat.UncompressedPoint
)

print("\nAdd these to your .env file:\n")
print("VAPID_PRIVATE_KEY=" + b64url(private_bytes))
print("VAPID_PUBLIC_KEY=" + b64url(public_bytes))
print("VAPID_EMAIL=mailto:your-email@example.com")
