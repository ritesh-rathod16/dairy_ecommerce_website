"""
Delivery partner endpoints. A delivery partner is just a user with
role="delivery_partner" (created by an admin — see routers/admin.py).

Two separate "status" concepts on an order, on purpose:
- `status` (placed/confirmed/packed/out_for_delivery/delivered/cancelled) —
  the coarse status every other part of the app (admin dashboard,
  analytics, customer tracking) already relies on. Left untouched so
  nothing else breaks.
- `delivery_stage` (DELIVERY_STAGES, below) — the fine-grained, manually-
  advanced workflow a delivery partner actually walks through. Kept as a
  parallel field, synced into `status` at the two points that matter
  (picked up → out_for_delivery, delivered → delivered) so the rest of the
  app sees a consistent picture without needing to know about stages.

Note on "restaurant": this is a single-store app, not a multi-vendor
marketplace, so there's one pickup point — the store itself (from
settings.store_lat/lng/phone), not a per-order restaurant record.
"""
import io

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.database import orders_collection, users_collection
from app.security import require_role
from app.models.order import OrderOut, OrderItemOut, OrderStatusEvent, CustomerInfo, DELIVERY_STAGES
from app.services.email import notify_order_status_changed
from app.services import maps
from app.services.settings import get_runtime_settings
from app.services.push import notify_customer_push, notify_admins_push
from app.services.payment_audit import change_payment_status
from app.services.qr import build_upi_link, generate_qr_png_bytes
from app.config import settings

router = APIRouter(prefix="/api/delivery", tags=["delivery"])

# Stages at/after this point mean the partner has already left the store —
# rejecting past this point would strand the order, so it's blocked.
REJECTABLE_STAGES = {"assigned", "accepted", "heading_to_store", "reached_store", "packed"}


async def _to_order_out(d: dict, customer_doc: Optional[dict] = None) -> OrderOut:
    customer = None
    if customer_doc:
        customer = CustomerInfo(name=customer_doc.get("name", ""), phone=customer_doc.get("phone", ""))
    return OrderOut(
        id=d["_id"], order_number=d["order_number"], user_id=d["user_id"],
        items=[OrderItemOut(**i) for i in d["items"]],
        subtotal=d["subtotal"], delivery_fee=d["delivery_fee"], total=d["total"],
        address=d["address"], payment_method=d["payment_method"],
        payment_status=d.get("payment_status", "pending"), status=d["status"],
        timeline=[OrderStatusEvent(**t) for t in d["timeline"]],
        notes=d.get("notes"), created_at=d["created_at"],
        delivery_partner_id=d.get("delivery_partner_id"),
        delivery_partner_name=d.get("delivery_partner_name"),
        delivery_partner_phone=d.get("delivery_partner_phone"),
        delivery_location=d.get("delivery_location"),
        customer=customer,
        payment_collected_by=d.get("payment_collected_by"),
        payment_collected_at=d.get("payment_collected_at"),
        payment_history=d.get("payment_history", []),
        payment_collection_method=d.get("payment_collection_method"),
        delivery_stage=d.get("delivery_stage"),
        delivery_stage_timeline=d.get("delivery_stage_timeline", []),
        reject_reason=d.get("reject_reason"),
    )


@router.get("/my-orders", response_model=list[OrderOut])
async def my_assigned_orders(partner=Depends(require_role("delivery_partner"))):
    docs = await orders_collection.find(
        {"delivery_partner_id": partner["_id"], "status": {"$nin": ["delivered", "cancelled"]}}
    ).sort("created_at", 1).to_list(length=200)

    customer_ids = list({d["user_id"] for d in docs})
    customers = await users_collection.find({"_id": {"$in": customer_ids}}).to_list(length=len(customer_ids) or 1)
    customer_map = {c["_id"]: c for c in customers}

    return [await _to_order_out(d, customer_map.get(d["user_id"])) for d in docs]


@router.get("/orders/{order_id}/route")
async def get_route_info(order_id: str, partner=Depends(require_role("delivery_partner"))):
    """
    Distance/ETA from the store to this order's delivery address, plus
    key-free Google Maps navigation links. If the order has no coordinates
    yet, geocodes the saved address once and persists the result — never
    re-geocoded on subsequent calls.
    """
    order = await orders_collection.find_one({"_id": order_id, "delivery_partner_id": partner["_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or not assigned to you")

    rt = await get_runtime_settings()
    store = {
        "name": rt["merchant_name"],
        "phone": settings.store_phone or None,
        "address": settings.store_address or None,
        "lat": settings.store_lat,
        "lng": settings.store_lng,
        "nav_link": f"https://www.google.com/maps/dir/?api=1&destination={settings.store_lat},{settings.store_lng}",
    }

    addr = order["address"]
    dest_lat, dest_lng = addr.get("lat"), addr.get("lng")
    warning = None

    if dest_lat is None or dest_lng is None:
        full_address = f"{addr['line1']}, {addr.get('line2', '')}, {addr['city']} {addr['pincode']}, India"
        geocoded = await maps.geocode_address(full_address)
        if geocoded:
            dest_lat, dest_lng = geocoded["lat"], geocoded["lng"]
            await orders_collection.update_one(
                {"_id": order_id}, {"$set": {"address.lat": dest_lat, "address.lng": dest_lng}}
            )
        else:
            warning = "Could not automatically locate this address — navigate using the saved address text instead."

    route = None
    customer_nav_link = None
    if dest_lat is not None and dest_lng is not None:
        customer_nav_link = f"https://www.google.com/maps/dir/?api=1&destination={dest_lat},{dest_lng}"
        route = await maps.route_info_from_store(dest_lat, dest_lng)
        if route is None and warning is None:
            warning = "Live distance/ETA isn't available right now — showing the saved address instead."

    return {
        "store": store,
        "customer_lat": dest_lat,
        "customer_lng": dest_lng,
        "customer_nav_link": customer_nav_link,
        "route": route,
        "warning": warning,
    }


# ---------- Fine-grained delivery stage workflow ----------

class StageUpdate(BaseModel):
    stage: str


@router.patch("/orders/{order_id}/stage", response_model=OrderOut)
async def update_delivery_stage(order_id: str, payload: StageUpdate, partner=Depends(require_role("delivery_partner"))):
    if payload.stage not in DELIVERY_STAGES:
        raise HTTPException(status_code=400, detail=f"stage must be one of: {', '.join(DELIVERY_STAGES)}")

    order = await orders_collection.find_one({"_id": order_id, "delivery_partner_id": partner["_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or not assigned to you")

    if payload.stage == "delivered" and order.get("payment_status") != "paid":
        raise HTTPException(
            status_code=409,
            detail=f"This order isn't marked paid yet (₹{order['total']} outstanding). Collect payment first.",
        )

    now = datetime.now(timezone.utc)
    update: dict = {"delivery_stage": payload.stage}
    status_event = None

    if payload.stage == "picked_up" and order["status"] not in ("out_for_delivery", "delivered"):
        update["status"] = "out_for_delivery"
        status_event = "out_for_delivery"
    elif payload.stage == "delivered":
        update["status"] = "delivered"
        update["delivery_location"] = None
        status_event = "delivered"

    push_ops = {"$set": update, "$push": {"delivery_stage_timeline": {"stage": payload.stage, "at": now}}}
    if status_event:
        push_ops["$push"]["timeline"] = {"status": status_event, "at": now}

    await orders_collection.update_one({"_id": order_id}, push_ops)

    customer = await users_collection.find_one({"_id": order["user_id"]})
    if customer and status_event:
        notify_order_status_changed(customer["email"], order["order_number"], status_event)
        await notify_customer_push(
            customer["_id"],
            title="✅ Order Delivered" if status_event == "delivered" else "🚚 Order is on the way",
            body=f"Order #{order['order_number']} is now {status_event.replace('_', ' ')}.",
            url=f"/orders/{order_id}",
        )

    updated = await orders_collection.find_one({"_id": order_id})
    return await _to_order_out(updated, customer)


class RejectIn(BaseModel):
    reason: str


@router.post("/orders/{order_id}/reject")
async def reject_order(order_id: str, payload: RejectIn, partner=Depends(require_role("delivery_partner"))):
    order = await orders_collection.find_one({"_id": order_id, "delivery_partner_id": partner["_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or not assigned to you")
    if order.get("delivery_stage") not in REJECTABLE_STAGES or order["status"] == "out_for_delivery":
        raise HTTPException(status_code=400, detail="Can't reject an order that's already picked up — contact an admin")

    await orders_collection.update_one(
        {"_id": order_id},
        {"$set": {
            "delivery_partner_id": None, "delivery_partner_name": None, "delivery_partner_phone": None,
            "delivery_stage": None, "reject_reason": payload.reason,
        }},
    )
    await notify_admins_push(
        title="⚠️ Delivery rejected",
        body=f"{partner['name']} rejected order #{order['order_number']} — {payload.reason}",
        url="/admin/orders",
    )
    return {"ok": True}


@router.get("/orders/{order_id}/qr")
async def get_collection_qr(order_id: str, partner=Depends(require_role("delivery_partner"))):
    order = await orders_collection.find_one({"_id": order_id, "delivery_partner_id": partner["_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or not assigned to you")

    rt = await get_runtime_settings()
    upi_link = build_upi_link(order["total"], order["order_number"], rt["upi_id"], rt["merchant_name"])
    png_bytes = generate_qr_png_bytes(upi_link)
    return StreamingResponse(io.BytesIO(png_bytes), media_type="image/png")


class MarkPaidIn(BaseModel):
    collection_method: str  # "cash" | "upi"
    transaction_reference: Optional[str] = None


@router.post("/orders/{order_id}/mark-paid", response_model=OrderOut)
async def mark_order_paid(order_id: str, payload: MarkPaidIn, partner=Depends(require_role("delivery_partner"))):
    if payload.collection_method not in ("cash", "upi"):
        raise HTTPException(status_code=400, detail="collection_method must be 'cash' or 'upi'")

    order = await orders_collection.find_one({"_id": order_id, "delivery_partner_id": partner["_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or not assigned to you")
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="This order is already marked paid — preventing a duplicate update.")

    await change_payment_status(order, "paid", partner["name"], "delivery_partner")
    extra = {"payment_collection_method": payload.collection_method}
    if payload.transaction_reference:
        extra["payment_transaction_reference"] = payload.transaction_reference
    await orders_collection.update_one({"_id": order_id}, {"$set": extra})
    updated = await orders_collection.find_one({"_id": order_id})

    customer = await users_collection.find_one({"_id": order["user_id"]})
    return await _to_order_out(updated, customer)


class LocationPing(BaseModel):
    lat: float
    lng: float


@router.post("/location")
async def update_location(payload: LocationPing, partner=Depends(require_role("delivery_partner"))):
    now = datetime.now(timezone.utc)
    location = {"lat": payload.lat, "lng": payload.lng, "updated_at": now}

    await users_collection.update_one({"_id": partner["_id"]}, {"$set": {"last_location": location}})
    await orders_collection.update_many(
        {"delivery_partner_id": partner["_id"], "status": "out_for_delivery"},
        {"$set": {"delivery_location": location}},
    )
    return {"ok": True, "location": location}


# ---------- Dashboard stats ----------

async def _delivered_orders_for(partner_id: str, start: Optional[datetime] = None) -> list:
    query: dict = {"delivery_partner_id": partner_id, "status": "delivered"}
    if start:
        query["created_at"] = {"$gte": start}
    return await orders_collection.find(query).to_list(length=20000)


def _avg_delivery_minutes(orders: list) -> Optional[float]:
    durations = []
    for o in orders:
        out_at = delivered_at = None
        for e in o.get("timeline", []):
            if e["status"] == "out_for_delivery" and out_at is None:
                out_at = e["at"]
            if e["status"] == "delivered":
                delivered_at = e["at"]
        if out_at and delivered_at and delivered_at > out_at:
            durations.append((delivered_at - out_at).total_seconds() / 60)
    return round(sum(durations) / len(durations), 1) if durations else None


@router.get("/stats")
async def delivery_stats(partner=Depends(require_role("delivery_partner"))):
    pid = partner["_id"]
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)

    today_assigned = await orders_collection.count_documents({"delivery_partner_id": pid, "created_at": {"$gte": today_start}})
    today_delivered_docs = await _delivered_orders_for(pid, today_start)
    today_pending = await orders_collection.count_documents({
        "delivery_partner_id": pid, "status": {"$nin": ["delivered", "cancelled"]},
    })

    week_delivered = await _delivered_orders_for(pid, week_start)
    month_delivered = await _delivered_orders_for(pid, month_start)
    all_time_delivered = await _delivered_orders_for(pid)

    today_cash = sum(o["total"] for o in today_delivered_docs if o.get("payment_collection_method") == "cash")
    today_upi_collected = sum(
        o["total"] for o in today_delivered_docs
        if o.get("payment_collection_method") == "upi" or (o["payment_method"] == "ONLINE" and o.get("payment_status") == "paid")
    )
    pending_payment_orders = await orders_collection.find({
        "delivery_partner_id": pid, "payment_status": {"$ne": "paid"}, "status": {"$nin": ["delivered", "cancelled"]},
    }).to_list(length=1000)
    pending_payment_amount = sum(o["total"] for o in pending_payment_orders)

    fastest_all_time = None
    durations_all = []
    for o in all_time_delivered:
        out_at = delivered_at = None
        for e in o.get("timeline", []):
            if e["status"] == "out_for_delivery" and out_at is None:
                out_at = e["at"]
            if e["status"] == "delivered":
                delivered_at = e["at"]
        if out_at and delivered_at and delivered_at > out_at:
            durations_all.append((delivered_at - out_at).total_seconds() / 60)
    if durations_all:
        fastest_all_time = round(min(durations_all), 1)

    return {
        "today": {
            "assigned": today_assigned,
            "completed": len(today_delivered_docs),
            "pending": today_pending,
            "cash_collected": round(today_cash, 2),
            "upi_collected": round(today_upi_collected, 2),
        },
        "pending_payments": {
            "count": len(pending_payment_orders),
            "amount": round(pending_payment_amount, 2),
        },
        "performance": {
            "total_completed": len(all_time_delivered),
            "this_week_completed": len(week_delivered),
            "this_month_completed": len(month_delivered),
            "avg_delivery_minutes": _avg_delivery_minutes(all_time_delivered),
            "fastest_delivery_minutes": fastest_all_time,
        },
        "profile": {
            "name": partner["name"], "phone": partner["phone"], "email": partner["email"],
            "joined_at": partner.get("joined_at"),
        },
        "_note": "Rejected-order counts aren't tracked per-partner (rejecting un-assigns the order, so there's no lasting attribution) — delivery history covers each partner's own completed/cancelled record instead.",
    }


# ---------- Delivery history ----------

@router.get("/history")
async def delivery_history(
    date_from: Optional[str] = None, date_to: Optional[str] = None, status: Optional[str] = None,
    partner=Depends(require_role("delivery_partner")),
):
    """status filter: delivered | cancelled."""
    query: dict = {"delivery_partner_id": partner["_id"]}
    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
        if date_to:
            date_filter["$lt"] = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc) + timedelta(days=1)
        query["created_at"] = date_filter
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": ["delivered", "cancelled"]}

    docs = await orders_collection.find(query).sort("created_at", -1).to_list(length=2000)
    return [
        {
            "id": d["_id"], "order_number": d["order_number"], "status": d["status"],
            "total": d["total"], "payment_status": d.get("payment_status"),
            "payment_collection_method": d.get("payment_collection_method"),
            "created_at": d["created_at"],
        }
        for d in docs
    ]
