"""
Generates a VAPID keypair for Web Push.

Two ways to run this:

1. This script (uses the `cryptography` library directly, which pywebpush
   already depends on, so no extra install):

       cd backend && source .venv/bin/activate
       python generate_vapid_keys.py

2. If pywebpush's own output doesn't accept the keys this script prints,
   fall back to py_vapid's own CLI tool instead — it ships with the
   package and is guaranteed to produce a format pywebpush accepts:

       vapid --gen
       # then read the printed applicationServerKey / private key files

Either way, paste the resulting VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY into
.env. Keep the private key secret. The public key is safe to expose to the
frontend (it's needed there to open a push subscription).

Note: this script encodes the private key as the raw 32-byte P-256 scalar
(base64url, no padding) — the format used by the Node `web-push` library
and expected by py_vapid's Vapid.from_string()/from_raw(). If you hit a
"could not deserialize key" error from pywebpush when actually sending a
notification, use the `vapid --gen` CLI fallback above instead — this
script is a convenience, not the authoritative source for the format.
"""
import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def main():
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()

    # Raw 32-byte private scalar — the standard VAPID private-key format.
    private_numbers = private_key.private_numbers()
    private_raw = private_numbers.private_value.to_bytes(32, byteorder="big")

    # Raw 65-byte uncompressed EC point — the standard VAPID public-key format
    # (also what the browser's PushManager.subscribe() applicationServerKey expects).
    public_raw = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )

    print("\nAdd these to your .env:\n")
    print(f"VAPID_PUBLIC_KEY={b64url(public_raw)}")
    print(f"VAPID_PRIVATE_KEY={b64url(private_raw)}")
    print("\nAlso set VAPID_CLAIMS_EMAIL to a real contact email (required by the push spec).")
    print("\nIf sending a real push later fails with a key-format error, regenerate with the")
    print("'vapid --gen' CLI tool instead (installed alongside py_vapid) and use its output.")


if __name__ == "__main__":
    main()
