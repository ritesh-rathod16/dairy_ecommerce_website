import uuid
import csv
import io
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel, Field, EmailStr

from app.database import products_collection, categories_collection, orders_collection, users_collection, carts_collection
from app.security import require_admin, hash_password
from app.models.order import OrderOut, OrderItemOut, OrderStatusEvent, ORDER_STATUSES
from app.services.email import notify_order_status_changed
from app.services.push import notify_customer_push, notify_delivery_partner_push
from app.services.payment_audit import change_payment_status
from app.services.settings import get_runtime_settings, update_runtime_settings
from app.services.invoice import build_invoice_pdf
from app.services.analytics import compute_analytics
from app.services.analytics_export import build_analytics_pdf, build_analytics_excel
from app.config import settings

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------- Image upload (products can use this OR a pasted URL) ----------

import os
from fastapi import UploadFile, File
from PIL import Image

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
MAX_DIMENSION = 1200


@router.post("/upload-image")
async def admin_upload_image(file: UploadFile = File(...), admin=Depends(require_admin)):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, or WebP images are supported")

    raw = await file.read()
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image is too large (max 8MB)")

    try:
        img = Image.open(io.BytesIO(raw))
        img = img.convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read this image file")

    # Compress: cap the longest side and re-encode as JPEG at 82% quality.
    if max(img.size) > MAX_DIMENSION:
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))

    filename = f"{uuid.uuid4()}.jpg"
    filepath = os.path.join(UPLOAD_DIR, filename)
    img.save(filepath, "JPEG", quality=82, optimize=True)

    return {"url": f"/uploads/{filename}"}


# ---------- Categories ----------

class CategoryIn(BaseModel):
    name: str
    slug: str
    icon: Optional[str] = None
    sort_order: int = 0


@router.get("/categories")
async def admin_list_categories(admin=Depends(require_admin)):
    cats = await categories_collection.find().sort("sort_order", 1).to_list(length=200)
    return [{**c, "id": c["_id"]} for c in cats]


@router.post("/categories", status_code=201)
async def admin_create_category(payload: CategoryIn, admin=Depends(require_admin)):
    existing = await categories_collection.find_one({"slug": payload.slug})
    if existing:
        raise HTTPException(status_code=400, detail="A category with this slug already exists")
    cat_id = str(uuid.uuid4())
    doc = {"_id": cat_id, **payload.model_dump()}
    await categories_collection.insert_one(doc)
    return {**doc, "id": cat_id}


@router.delete("/categories/{category_id}", status_code=204)
async def admin_delete_category(category_id: str, admin=Depends(require_admin)):
    in_use = await products_collection.count_documents({"category_id": category_id})
    if in_use > 0:
        raise HTTPException(status_code=400, detail=f"{in_use} product(s) still use this category")
    await categories_collection.delete_one({"_id": category_id})


# ---------- Products ----------

class ProductIn(BaseModel):
    name: str
    slug: str
    description: str = ""
    category_id: str
    price: float = Field(gt=0)
    mrp: float = Field(gt=0)
    unit: str
    image: Optional[str] = None
    stock: int = Field(ge=0)
    is_available: bool = True
    gst_percent: float = 0
    tags: list[str] = []


@router.get("/products")
async def admin_list_products(admin=Depends(require_admin)):
    products = await products_collection.find().sort("name", 1).to_list(length=1000)
    return [{**p, "id": p["_id"]} for p in products]


@router.post("/products", status_code=201)
async def admin_create_product(payload: ProductIn, admin=Depends(require_admin)):
    cat = await categories_collection.find_one({"_id": payload.category_id})
    if not cat:
        raise HTTPException(status_code=400, detail="Category not found")
    existing = await products_collection.find_one({"slug": payload.slug})
    if existing:
        raise HTTPException(status_code=400, detail="A product with this slug already exists")

    product_id = str(uuid.uuid4())
    doc = {"_id": product_id, **payload.model_dump()}
    await products_collection.insert_one(doc)
    return {**doc, "id": product_id}


@router.put("/products/{product_id}")
async def admin_update_product(product_id: str, payload: ProductIn, admin=Depends(require_admin)):
    existing = await products_collection.find_one({"_id": product_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    await products_collection.update_one({"_id": product_id}, {"$set": payload.model_dump()})
    updated = await products_collection.find_one({"_id": product_id})
    return {**updated, "id": product_id}


@router.delete("/products/{product_id}", status_code=204)
async def admin_delete_product(product_id: str, admin=Depends(require_admin)):
    await products_collection.delete_one({"_id": product_id})


# ---------- Orders ----------

class OrderStatusUpdate(BaseModel):
    status: str


class PaymentStatusUpdate(BaseModel):
    payment_status: str  # "pending" | "pending_verification" | "paid"


def _to_order_out(d: dict) -> OrderOut:
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
        payment_collected_by=d.get("payment_collected_by"),
        payment_collected_at=d.get("payment_collected_at"),
        payment_history=d.get("payment_history", []),
        payment_collection_method=d.get("payment_collection_method"),
        delivery_stage=d.get("delivery_stage"),
        delivery_stage_timeline=d.get("delivery_stage_timeline", []),
        reject_reason=d.get("reject_reason"),
    )


@router.get("/orders", response_model=list[OrderOut])
async def admin_list_orders(status: Optional[str] = None, search: Optional[str] = None, admin=Depends(require_admin)):
    query: dict = {}
    if status:
        query["status"] = status
    if search:
        query["order_number"] = {"$regex": search, "$options": "i"}
    docs = await orders_collection.find(query).sort("created_at", -1).to_list(length=500)
    return [_to_order_out(d) for d in docs]


@router.patch("/orders/{order_id}/status", response_model=OrderOut)
async def admin_update_order_status(order_id: str, payload: OrderStatusUpdate, admin=Depends(require_admin)):
    if payload.status not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(ORDER_STATUSES)}")

    order = await orders_collection.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    now = datetime.now(timezone.utc)
    await orders_collection.update_one(
        {"_id": order_id},
        {"$set": {"status": payload.status}, "$push": {"timeline": {"status": payload.status, "at": now}}},
    )

    customer = await users_collection.find_one({"_id": order["user_id"]})
    if customer:
        notify_order_status_changed(customer["email"], order["order_number"], payload.status)
        status_emoji = {"confirmed": "👍", "packed": "📦", "out_for_delivery": "🚚", "delivered": "✅", "cancelled": "❌"}
        await notify_customer_push(
            customer["_id"],
            title=f"{status_emoji.get(payload.status, '📦')} Order {payload.status.replace('_', ' ').title()}",
            body=f"Order #{order['order_number']} is now {payload.status.replace('_', ' ')}.",
            url=f"/orders/{order_id}",
        )

    updated = await orders_collection.find_one({"_id": order_id})
    return _to_order_out(updated)


@router.patch("/orders/{order_id}/payment-status", response_model=OrderOut)
async def admin_update_payment_status(order_id: str, payload: PaymentStatusUpdate, admin=Depends(require_admin)):
    valid_statuses = ["pending", "pending_verification", "paid"]
    if payload.payment_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid payment status. Must be one of: {', '.join(valid_statuses)}")

    order = await orders_collection.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    updated = await change_payment_status(order, payload.payment_status, admin["name"], "admin")
    return _to_order_out(updated)


# ---------- Delivery partners ----------

class StatusUpdate(BaseModel):
    status: str  # "active" | "suspended"


class DeliveryPartnerIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str = Field(min_length=6)


@router.get("/delivery-partners")
async def admin_list_delivery_partners(admin=Depends(require_admin)):
    partners = await users_collection.find({"role": "delivery_partner"}).sort("name", 1).to_list(length=500)
    return [
        {
            "id": p["_id"], "name": p["name"], "email": p["email"], "phone": p["phone"],
            "status": p.get("status", "active"),
            "last_location": p.get("last_location"),
        }
        for p in partners
    ]


@router.post("/delivery-partners", status_code=201)
async def admin_create_delivery_partner(payload: DeliveryPartnerIn, admin=Depends(require_admin)):
    existing = await users_collection.find_one({"$or": [{"email": payload.email}, {"phone": payload.phone}]})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email or phone already exists")

    partner_id = str(uuid.uuid4())
    await users_collection.insert_one({
        "_id": partner_id,
        "name": payload.name,
        "email": payload.email,
        "phone": payload.phone,
        "password_hash": hash_password(payload.password),
        "addresses": [],
        "role": "delivery_partner",
        "status": "active",
        "joined_at": datetime.now(timezone.utc),
    })
    return {"id": partner_id, "name": payload.name, "email": payload.email, "phone": payload.phone}


@router.patch("/delivery-partners/{partner_id}/status")
async def admin_update_delivery_partner_status(partner_id: str, payload: StatusUpdate, admin=Depends(require_admin)):
    if payload.status not in ("active", "suspended"):
        raise HTTPException(status_code=400, detail="status must be 'active' or 'suspended'")
    partner = await users_collection.find_one({"_id": partner_id, "role": "delivery_partner"})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    await users_collection.update_one({"_id": partner_id}, {"$set": {"status": payload.status}})
    return {"id": partner_id, "status": payload.status}


@router.delete("/delivery-partners/{partner_id}", status_code=204)
async def admin_delete_delivery_partner(partner_id: str, admin=Depends(require_admin)):
    active = await orders_collection.count_documents(
        {"delivery_partner_id": partner_id, "status": {"$in": ["packed", "out_for_delivery"]}}
    )
    if active > 0:
        raise HTTPException(status_code=400, detail=f"This partner still has {active} active deliveries assigned")
    await users_collection.delete_one({"_id": partner_id, "role": "delivery_partner"})


class OrderAssignIn(BaseModel):
    delivery_partner_id: str


@router.patch("/orders/{order_id}/assign", response_model=OrderOut)
async def admin_assign_order(order_id: str, payload: OrderAssignIn, admin=Depends(require_admin)):
    order = await orders_collection.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    partner = await users_collection.find_one({"_id": payload.delivery_partner_id, "role": "delivery_partner"})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")

    now = datetime.now(timezone.utc)
    await orders_collection.update_one(
        {"_id": order_id},
        {"$set": {
            "delivery_partner_id": partner["_id"],
            "delivery_partner_name": partner["name"],
            "delivery_partner_phone": partner["phone"],
            "delivery_stage": "assigned",
            "reject_reason": None,
        }, "$push": {"delivery_stage_timeline": {"stage": "assigned", "at": now}}},
    )
    await notify_delivery_partner_push(
        partner["_id"],
        title="🍕 New Delivery Order",
        body=f"Order #{order['order_number']} — ₹{order['total']} — assigned to you.",
        url="/delivery",
    )
    updated = await orders_collection.find_one({"_id": order_id})
    return _to_order_out(updated)


@router.get("/orders/{order_id}/invoice")
async def admin_download_invoice(order_id: str, admin=Depends(require_admin)):
    order = await orders_collection.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    customer = await users_collection.find_one({"_id": order["user_id"]}) or {}
    pdf_bytes = await build_invoice_pdf(order, customer)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="invoice-{order["order_number"]}.pdf"'},
    )


# ---------- Employees (Manager / Warehouse / Support) ----------

EMPLOYEE_ROLES = ["manager", "warehouse", "support"]


class EmployeeIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str = Field(min_length=6)
    role: str
    notes: Optional[str] = ""


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    notes: Optional[str] = None


def _employee_out(u: dict) -> dict:
    return {
        "id": u["_id"], "name": u["name"], "email": u["email"], "phone": u["phone"],
        "role": u.get("role"), "status": u.get("status", "active"),
        "notes": u.get("notes", ""), "joined_at": u.get("joined_at"),
    }


@router.get("/employees")
async def admin_list_employees(role: Optional[str] = None, search: Optional[str] = None, admin=Depends(require_admin)):
    query: dict = {"role": {"$in": EMPLOYEE_ROLES}}
    if role:
        if role not in EMPLOYEE_ROLES:
            raise HTTPException(status_code=400, detail=f"role must be one of: {', '.join(EMPLOYEE_ROLES)}")
        query["role"] = role
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    employees = await users_collection.find(query).sort("name", 1).to_list(length=1000)
    return [_employee_out(e) for e in employees]


@router.post("/employees", status_code=201)
async def admin_create_employee(payload: EmployeeIn, admin=Depends(require_admin)):
    if payload.role not in EMPLOYEE_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of: {', '.join(EMPLOYEE_ROLES)}")
    existing = await users_collection.find_one({"$or": [{"email": payload.email}, {"phone": payload.phone}]})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email or phone already exists")

    employee_id = str(uuid.uuid4())
    doc = {
        "_id": employee_id,
        "name": payload.name,
        "email": payload.email,
        "phone": payload.phone,
        "password_hash": hash_password(payload.password),
        "addresses": [],
        "role": payload.role,
        "status": "active",
        "notes": payload.notes or "",
        "joined_at": datetime.now(timezone.utc),
    }
    await users_collection.insert_one(doc)
    return _employee_out(doc)


@router.put("/employees/{employee_id}")
async def admin_update_employee(employee_id: str, payload: EmployeeUpdate, admin=Depends(require_admin)):
    employee = await users_collection.find_one({"_id": employee_id, "role": {"$in": EMPLOYEE_ROLES}})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if payload.role is not None and payload.role not in EMPLOYEE_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of: {', '.join(EMPLOYEE_ROLES)}")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await users_collection.update_one({"_id": employee_id}, {"$set": updates})
    updated = await users_collection.find_one({"_id": employee_id})
    return _employee_out(updated)


@router.patch("/employees/{employee_id}/status")
async def admin_update_employee_status(employee_id: str, payload: StatusUpdate, admin=Depends(require_admin)):
    if payload.status not in ("active", "suspended"):
        raise HTTPException(status_code=400, detail="status must be 'active' or 'suspended'")
    employee = await users_collection.find_one({"_id": employee_id, "role": {"$in": EMPLOYEE_ROLES}})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    await users_collection.update_one({"_id": employee_id}, {"$set": {"status": payload.status}})
    updated = await users_collection.find_one({"_id": employee_id})
    return _employee_out(updated)


@router.delete("/employees/{employee_id}", status_code=204)
async def admin_delete_employee(employee_id: str, admin=Depends(require_admin)):
    await users_collection.delete_one({"_id": employee_id, "role": {"$in": EMPLOYEE_ROLES}})


# ---------- Dashboard ----------

@router.get("/dashboard")
async def admin_dashboard(admin=Depends(require_admin)):
    now = datetime.now(timezone.utc)
    since_7d = now - timedelta(days=7)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total_orders = await orders_collection.count_documents({})
    orders_7d = await orders_collection.count_documents({"created_at": {"$gte": since_7d}})
    pending_orders = await orders_collection.count_documents(
        {"status": {"$in": ["placed", "confirmed", "packed", "out_for_delivery"]}}
    )
    total_products = await products_collection.count_documents({})
    low_stock = await products_collection.count_documents({"stock": {"$lte": 5}})
    total_customers = await users_collection.count_documents({"role": "customer"})

    revenue_cursor = orders_collection.aggregate([
        {"$match": {"status": {"$ne": "cancelled"}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ])
    revenue_docs = await revenue_cursor.to_list(length=1)
    total_revenue = revenue_docs[0]["total"] if revenue_docs else 0

    today_cursor = orders_collection.aggregate([
        {"$match": {"status": {"$ne": "cancelled"}, "created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ])
    today_docs = await today_cursor.to_list(length=1)
    today_sales = today_docs[0]["total"] if today_docs else 0
    today_order_count = today_docs[0]["count"] if today_docs else 0

    top_products_cursor = orders_collection.aggregate([
        {"$match": {"status": {"$ne": "cancelled"}}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.name", "qty": {"$sum": "$items.quantity"}}},
        {"$sort": {"qty": -1}},
        {"$limit": 5},
    ])
    top_products = await top_products_cursor.to_list(length=5)

    recent_orders = await orders_collection.find().sort("created_at", -1).limit(5).to_list(length=5)

    return {
        "total_orders": total_orders,
        "orders_last_7_days": orders_7d,
        "pending_orders": pending_orders,
        "total_products": total_products,
        "low_stock_products": low_stock,
        "total_customers": total_customers,
        "total_revenue": round(total_revenue, 2),
        "today_sales": round(today_sales, 2),
        "today_order_count": today_order_count,
        "top_products": [{"name": p["_id"], "quantity_sold": p["qty"]} for p in top_products],
        "recent_orders": [
            {
                "id": o["_id"], "order_number": o["order_number"], "status": o["status"],
                "total": o["total"], "created_at": o["created_at"],
            }
            for o in recent_orders
        ],
    }


# ---------- Settings ----------

class SettingsUpdate(BaseModel):
    upi_id: Optional[str] = None
    merchant_name: Optional[str] = None


@router.get("/settings")
async def admin_get_settings(admin=Depends(require_admin)):
    rt = await get_runtime_settings()
    return {**rt, "store_lat": settings.store_lat, "store_lng": settings.store_lng}


@router.put("/settings")
async def admin_update_settings(payload: SettingsUpdate, admin=Depends(require_admin)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None and v != ""}
    return await update_runtime_settings(updates)


# ---------- Analytics (date-range, full BI dashboard) ----------

def _parse_range(date_from: Optional[str], date_to: Optional[str]) -> tuple:
    now = datetime.now(timezone.utc)
    if date_to:
        end = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc) + timedelta(days=1)
    else:
        end = now
    if date_from:
        start = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
    else:
        start = end - timedelta(days=30)
    return start, end


@router.get("/analytics")
async def admin_analytics(
    date_from: Optional[str] = None, date_to: Optional[str] = None,
    payment_method: Optional[str] = None, order_status: Optional[str] = None, category: Optional[str] = None,
    admin=Depends(require_admin),
):
    """
    date_from / date_to are ISO date strings (YYYY-MM-DD). If omitted,
    defaults to the last 30 days. payment_method: COD|ONLINE. order_status:
    any valid order status. category: a category slug. All filters optional
    and combinable. Powers the Analytics dashboard's KPIs, charts, and
    tables — see app/services/analytics.py for the actual computation.
    """
    start, end = _parse_range(date_from, date_to)
    return await compute_analytics(start, end, payment_method, order_status, category)


@router.get("/analytics/export.pdf")
async def export_analytics_pdf(
    date_from: Optional[str] = None, date_to: Optional[str] = None,
    payment_method: Optional[str] = None, order_status: Optional[str] = None, category: Optional[str] = None,
    admin=Depends(require_admin),
):
    start, end = _parse_range(date_from, date_to)
    data = await compute_analytics(start, end, payment_method, order_status, category)
    rt = await get_runtime_settings()
    pdf_bytes = build_analytics_pdf(data, rt["merchant_name"])
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="analytics-{data["range"]["from"]}-to-{data["range"]["to"]}.pdf"'},
    )


@router.get("/analytics/export.xlsx")
async def export_analytics_excel(
    date_from: Optional[str] = None, date_to: Optional[str] = None,
    payment_method: Optional[str] = None, order_status: Optional[str] = None, category: Optional[str] = None,
    admin=Depends(require_admin),
):
    start, end = _parse_range(date_from, date_to)
    data = await compute_analytics(start, end, payment_method, order_status, category)
    xlsx_bytes = build_analytics_excel(data)
    return Response(
        content=xlsx_bytes, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="analytics-{data["range"]["from"]}-to-{data["range"]["to"]}.xlsx"'},
    )


# ---------- Export (CSV) ----------

def _csv_response(rows: list[dict], filename: str) -> StreamingResponse:
    buf = io.StringIO()
    if rows:
        writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/orders.csv")
async def export_orders_csv(admin=Depends(require_admin)):
    orders = await orders_collection.find().sort("created_at", -1).to_list(length=10000)
    rows = [
        {
            "order_number": o["order_number"],
            "created_at": o["created_at"].isoformat(),
            "status": o["status"],
            "payment_method": o["payment_method"],
            "payment_status": o.get("payment_status", ""),
            "subtotal": o["subtotal"],
            "delivery_fee": o["delivery_fee"],
            "total": o["total"],
            "items": "; ".join(f"{i['name']} x{i['quantity']}" for i in o["items"]),
            "address": f"{o['address']['line1']}, {o['address']['city']} - {o['address']['pincode']}",
            "delivery_partner": o.get("delivery_partner_name", ""),
        }
        for o in orders
    ]
    return _csv_response(rows, "orders.csv")


@router.get("/export/products.csv")
async def export_products_csv(admin=Depends(require_admin)):
    products = await products_collection.find().sort("name", 1).to_list(length=10000)
    rows = [
        {
            "name": p["name"], "slug": p["slug"], "category_id": p["category_id"],
            "price": p["price"], "mrp": p["mrp"], "unit": p["unit"], "stock": p["stock"],
            "is_available": p.get("is_available", True), "gst_percent": p.get("gst_percent", 0),
        }
        for p in products
    ]
    return _csv_response(rows, "products.csv")


@router.get("/export/users.csv")
async def export_users_csv(admin=Depends(require_admin)):
    users = await users_collection.find().sort("name", 1).to_list(length=10000)
    rows = [
        {"name": u["name"], "email": u["email"], "phone": u["phone"], "role": u.get("role", "customer")}
        for u in users
    ]
    return _csv_response(rows, "users.csv")


# ---------- Danger zone ----------

class DangerConfirm(BaseModel):
    confirm: str


def _require_delete_confirmation(payload: DangerConfirm):
    if payload.confirm != "DELETE":
        raise HTTPException(status_code=400, detail="Type DELETE exactly to confirm this action")


@router.get("/danger/preview/{target}")
async def danger_preview(target: str, admin=Depends(require_admin)):
    """Exact counts of what a given Danger Zone action will affect, shown in the confirm dialog before it runs."""
    if target == "delete-orders":
        n = await orders_collection.count_documents({})
        return {"will_delete": {"Orders": n}, "will_not_touch": ["Products", "Categories", "Customers", "Dashboard/Analytics config"]}
    if target == "delete-products":
        n = await products_collection.count_documents({})
        return {"will_delete": {"Products": n}, "will_not_touch": ["Categories", "Customers", "Orders"]}
    if target == "delete-categories":
        n = await categories_collection.count_documents({})
        affected_products = await products_collection.count_documents({"category_id": {"$ne": None}})
        return {
            "will_delete": {"Categories": n},
            "will_modify": {"Products (set to uncategorized)": affected_products},
            "will_not_touch": ["Customers", "Orders"],
        }
    if target == "delete-customers":
        n = await users_collection.count_documents({"role": "customer"})
        carts = await carts_collection.count_documents({})
        return {"will_delete": {"Customers": n, "Their carts": carts}, "will_not_touch": ["Admin accounts", "Products", "Categories", "Orders (kept for records)"]}
    if target == "delete-everything":
        return {
            "will_delete": {
                "Orders": await orders_collection.count_documents({}),
                "Products": await products_collection.count_documents({}),
                "Categories": await categories_collection.count_documents({}),
                "Non-admin users": await users_collection.count_documents({"role": {"$ne": "admin"}}),
                "Carts": await carts_collection.count_documents({}),
            },
            "will_not_touch": ["Admin accounts"],
        }
    raise HTTPException(status_code=404, detail="Unknown danger-zone target")


@router.post("/danger/delete-orders")
async def danger_delete_orders(payload: DangerConfirm, admin=Depends(require_admin)):
    _require_delete_confirmation(payload)
    result = await orders_collection.delete_many({})
    return {"deleted": result.deleted_count}


@router.post("/danger/delete-products")
async def danger_delete_products(payload: DangerConfirm, admin=Depends(require_admin)):
    _require_delete_confirmation(payload)
    result = await products_collection.delete_many({})
    return {"deleted": result.deleted_count}


@router.post("/danger/delete-categories")
async def danger_delete_categories(payload: DangerConfirm, admin=Depends(require_admin)):
    _require_delete_confirmation(payload)
    result = await categories_collection.delete_many({})
    # Products referencing a now-deleted category would otherwise keep a
    # dangling category_id — null it out so they become "uncategorized"
    # instead of silently pointing at nothing.
    await products_collection.update_many({}, {"$set": {"category_id": None}})
    return {"deleted": result.deleted_count}


@router.post("/danger/delete-customers")
async def danger_delete_customers(payload: DangerConfirm, admin=Depends(require_admin)):
    _require_delete_confirmation(payload)
    customers = await users_collection.find({"role": "customer"}, {"_id": 1}).to_list(length=100000)
    customer_ids = [c["_id"] for c in customers]
    result = await users_collection.delete_many({"role": "customer"})
    # Carts are a separate collection keyed by user_id — without this, deleted
    # customers would leave orphaned cart documents behind indefinitely.
    carts_result = await carts_collection.delete_many({"user_id": {"$in": customer_ids}})
    return {"deleted": result.deleted_count, "carts_deleted": carts_result.deleted_count}


@router.post("/danger/delete-everything")
async def danger_delete_everything(payload: DangerConfirm, admin=Depends(require_admin)):
    """Wipes orders, products, categories, and non-admin users. Admin accounts are kept
    so you don't lock yourself out."""
    _require_delete_confirmation(payload)
    o = await orders_collection.delete_many({})
    p = await products_collection.delete_many({})
    c = await categories_collection.delete_many({})
    u = await users_collection.delete_many({"role": {"$ne": "admin"}})
    cart_result = await carts_collection.delete_many({})
    return {
        "orders_deleted": o.deleted_count,
        "products_deleted": p.deleted_count,
        "categories_deleted": c.deleted_count,
        "users_deleted": u.deleted_count,
        "carts_deleted": cart_result.deleted_count,
    }
