"""
Merchant UPI payment — no payment gateway account needed.

How it actually works: we generate a real QR code (server-side, with the
`qrcode` library) that encodes a standard UPI deep link
(`upi://pay?pa=...&am=...`) for YOUR UPI ID. The customer scans it with any
UPI app (GPay, PhonePe, Paytm, BHIM...) and pays you directly — the money
goes straight to your bank account, same as any other UPI QR you'd print
and put on your counter.

The one thing this can't do without a paid gateway subscription is confirm
payment automatically — there's no webhook telling us "money arrived."
So the flow is: customer scans, pays, taps "I've paid" (order marked
`pending_verification`) — then you (or, for COD, the delivery partner at
the door) check and mark it `paid`. That's how most small merchants in
India actually reconcile UPI QR payments day to day.
"""
import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.database import orders_collection
from app.security import get_current_user
from app.services.settings import get_runtime_settings
from app.services.payment_audit import change_payment_status
from app.services.qr import build_upi_link, generate_qr_png_bytes

router = APIRouter(prefix="/api/payment", tags=["payment"])


@router.get("/upi-intent/{order_id}")
async def get_upi_intent(order_id: str, user=Depends(get_current_user)):
    order = await orders_collection.find_one({"_id": order_id, "user_id": user["_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    rt = await get_runtime_settings()
    return {
        "upi_id": rt["upi_id"],
        "merchant_name": rt["merchant_name"],
        "amount": order["total"],
        "order_number": order["order_number"],
        "upi_link": build_upi_link(order["total"], order["order_number"], rt["upi_id"], rt["merchant_name"]),
        "payment_status": order.get("payment_status", "pending"),
        "payment_collected_by": order.get("payment_collected_by"),
        "payment_collected_at": order.get("payment_collected_at"),
    }


@router.get("/upi-qr/{order_id}")
async def get_upi_qr(order_id: str, user=Depends(get_current_user)):
    """Returns a real PNG QR code encoding this order's UPI payment link, for the exact outstanding amount."""
    order = await orders_collection.find_one({"_id": order_id, "user_id": user["_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    rt = await get_runtime_settings()
    upi_link = build_upi_link(order["total"], order["order_number"], rt["upi_id"], rt["merchant_name"])
    png_bytes = generate_qr_png_bytes(upi_link)
    return StreamingResponse(io.BytesIO(png_bytes), media_type="image/png")


@router.post("/report-paid/{order_id}")
async def report_paid(order_id: str, user=Depends(get_current_user)):
    """
    Customer self-reports having completed the UPI payment. This does NOT
    mark the order as paid — it flags it for the merchant to verify against
    their UPI app / bank statement and confirm from the admin panel.
    """
    order = await orders_collection.find_one({"_id": order_id, "user_id": user["_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        return {"payment_status": "paid"}

    await change_payment_status(order, "pending_verification", user["name"], "customer")
    return {"payment_status": "pending_verification"}
