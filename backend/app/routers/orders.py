import random
import string
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.database import carts_collection, products_collection, orders_collection
from app.models.order import OrderCreate, OrderOut, OrderItemOut, OrderStatusEvent
from app.security import get_current_user
from app.config import settings
from app.services.email import notify_order_placed
from app.services import maps
from app.services.invoice import build_invoice_pdf
from app.services.push import notify_customer_push, notify_admins_push

router = APIRouter(prefix="/api/orders", tags=["orders"])


def _generate_order_number() -> str:
    suffix = "".join(random.choices(string.digits, k=6))
    return f"KD{suffix}"


def _to_order_out(d: dict) -> OrderOut:
    return OrderOut(
        id=d["_id"], order_number=d["order_number"], user_id=d["user_id"],
        items=[OrderItemOut(**i) for i in d["items"]],
        subtotal=d["subtotal"], delivery_fee=d["delivery_fee"], total=d["total"],
        address=d["address"], payment_method=d["payment_method"], payment_status=d.get("payment_status", "pending"),
        status=d["status"],
        timeline=[OrderStatusEvent(**t) for t in d["timeline"]],
        notes=d.get("notes"), created_at=d["created_at"],
        delivery_partner_id=d.get("delivery_partner_id"),
        delivery_partner_name=d.get("delivery_partner_name"),
        delivery_partner_phone=d.get("delivery_partner_phone"),
        delivery_location=d.get("delivery_location"),
        payment_collected_by=d.get("payment_collected_by"),
        payment_collected_at=d.get("payment_collected_at"),
        payment_history=d.get("payment_history", []),
        payment_collection_method=d.get("payment_collection_method"),
        delivery_stage=d.get("delivery_stage"),
        delivery_stage_timeline=d.get("delivery_stage_timeline", []),
        reject_reason=d.get("reject_reason"),
    )


@router.post("", response_model=OrderOut, status_code=201)
async def place_order(payload: OrderCreate, user=Depends(get_current_user)):
    cart = await carts_collection.find_one({"user_id": user["_id"]})
    cart_items = cart.get("items", []) if cart else []
    if not cart_items:
        raise HTTPException(status_code=400, detail="Your cart is empty")

    # If the address includes coordinates and Maps is configured, keep orders within the delivery radius.
    # Silently skips the check (rather than blocking checkout) if Maps isn't configured or the API call fails.
    if payload.address.lat is not None and payload.address.lng is not None:
        within_radius = await maps.is_within_delivery_radius(payload.address.lat, payload.address.lng)
        if within_radius is False:
            raise HTTPException(
                status_code=400,
                detail=f"Sorry, this address is outside our {settings.delivery_radius_km} km delivery radius.",
            )

    product_ids = [i["product_id"] for i in cart_items]
    products = await products_collection.find({"_id": {"$in": product_ids}}).to_list(length=len(product_ids))
    product_map = {p["_id"]: p for p in products}

    order_items = []
    subtotal = 0.0
    for i in cart_items:
        p = product_map.get(i["product_id"])
        if not p or not p.get("is_available", True):
            raise HTTPException(status_code=400, detail=f"A product in your cart is no longer available")
        if i["quantity"] > p.get("stock", 0):
            raise HTTPException(status_code=400, detail=f"Not enough stock for {p['name']}")
        line_total = round(p["price"] * i["quantity"], 2)
        subtotal += line_total
        order_items.append({
            "product_id": p["_id"], "name": p["name"], "unit": p["unit"],
            "price": p["price"], "quantity": i["quantity"], "line_total": line_total,
            "image": p.get("image"),
        })

    delivery_fee = 0.0 if subtotal >= settings.free_delivery_limit else 25.0
    total = round(subtotal + delivery_fee, 2)
    now = datetime.now(timezone.utc)

    order_doc = {
        "_id": str(uuid.uuid4()),
        "order_number": _generate_order_number(),
        "user_id": user["_id"],
        "items": order_items,
        "subtotal": round(subtotal, 2),
        "delivery_fee": delivery_fee,
        "total": total,
        "address": payload.address.model_dump(),
        "payment_method": payload.payment_method,
        "payment_status": "pending",
        "status": "placed",
        "timeline": [{"status": "placed", "at": now}],
        "notes": payload.notes,
        "created_at": now,
    }
    await orders_collection.insert_one(order_doc)

    # decrement stock
    for i in order_items:
        await products_collection.update_one(
            {"_id": i["product_id"]}, {"$inc": {"stock": -i["quantity"]}}
        )

    # clear cart
    await carts_collection.update_one({"user_id": user["_id"]}, {"$set": {"items": []}})

    notify_order_placed(user["email"], order_doc["order_number"], order_doc["total"])
    await notify_customer_push(
        user["_id"],
        title="🎉 Order Confirmed",
        body=f"Your order #{order_doc['order_number']} has been placed successfully.",
        url=f"/orders/{order_doc['_id']}",
    )
    await notify_admins_push(
        title="🛒 New Order Received",
        body=f"Order #{order_doc['order_number']} — ₹{order_doc['total']} from {user['name']}.",
        url="/admin/orders",
    )

    return _to_order_out(order_doc)


@router.get("", response_model=list[OrderOut])
async def list_my_orders(user=Depends(get_current_user)):
    cursor = orders_collection.find({"user_id": user["_id"]}).sort("created_at", -1)
    docs = await cursor.to_list(length=200)
    return [_to_order_out(d) for d in docs]


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: str, user=Depends(get_current_user)):
    d = await orders_collection.find_one({"_id": order_id, "user_id": user["_id"]})
    if not d:
        raise HTTPException(status_code=404, detail="Order not found")
    return _to_order_out(d)


@router.post("/{order_id}/cancel", response_model=OrderOut)
async def cancel_order(order_id: str, user=Depends(get_current_user)):
    d = await orders_collection.find_one({"_id": order_id, "user_id": user["_id"]})
    if not d:
        raise HTTPException(status_code=404, detail="Order not found")
    if d["status"] in ("out_for_delivery", "delivered", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Order cannot be cancelled once {d['status'].replace('_', ' ')}")

    now = datetime.now(timezone.utc)
    d["status"] = "cancelled"
    d["timeline"].append({"status": "cancelled", "at": now})
    await orders_collection.update_one(
        {"_id": order_id},
        {"$set": {"status": "cancelled"}, "$push": {"timeline": {"status": "cancelled", "at": now}}},
    )
    # restock
    for i in d["items"]:
        await products_collection.update_one(
            {"_id": i["product_id"]}, {"$inc": {"stock": i["quantity"]}}
        )
    return _to_order_out(d)


@router.get("/{order_id}/invoice")
async def download_invoice(order_id: str, user=Depends(get_current_user)):
    order = await orders_collection.find_one({"_id": order_id, "user_id": user["_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    pdf_bytes = await build_invoice_pdf(order, user)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="invoice-{order["order_number"]}.pdf"'},
    )
