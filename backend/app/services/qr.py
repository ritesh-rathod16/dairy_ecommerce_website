"""
UPI QR/link generation — the single place this logic lives, reused by both
the customer-facing payment endpoints and the delivery-partner COD
collection flow, so there's exactly one QR generator in the codebase.
"""
import io

import qrcode


def build_upi_link(amount: float, order_number: str, upi_id: str, merchant_name: str) -> str:
    return (
        f"upi://pay?pa={upi_id}"
        f"&pn={merchant_name.replace(' ', '%20')}"
        f"&am={amount}"
        f"&tn=Order%20{order_number}"
        f"&cu=INR"
    )


def generate_qr_png_bytes(upi_link: str) -> bytes:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=3,
    )
    qr.add_data(upi_link)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1B4332", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
