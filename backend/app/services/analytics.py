"""
All Analytics-page computation lives here, not in the router — keeps the
router thin and makes the metrics testable/reusable (the PDF/Excel export
endpoints call the exact same function as the JSON endpoint, so exports
can never drift from what's shown on screen).
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.database import orders_collection, users_collection, products_collection, categories_collection

ACTIVE_DELIVERY_STATUSES = ["packed", "out_for_delivery"]
LOW_STOCK_THRESHOLD = 5
ON_TIME_THRESHOLD_MINUTES = 45


def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Motor/PyMongo returns naive datetimes by default (BSON dates are UTC
    internally, but read back without tzinfo unless tz_aware=True is set on
    the client — it isn't, here), while dates built in this module or
    parsed from API query params are timezone-aware UTC. Comparing a naive
    datetime with an aware one raises TypeError, which is what was crashing
    the analytics endpoint. Every datetime that might come from either
    source is normalized through this before being compared or subtracted.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _pct_change(current: float, previous: float) -> Optional[float]:
    if previous == 0:
        return None if current == 0 else 100.0
    return round(((current - previous) / previous) * 100, 1)


async def _resolve_category_product_ids(category: str) -> list:
    cat = await categories_collection.find_one({"slug": category}) or await categories_collection.find_one({"_id": category})
    if not cat:
        return []
    cursor = products_collection.find({"category_id": cat["_id"]}, {"_id": 1})
    products = await cursor.to_list(length=10000)
    return [p["_id"] for p in products]


async def _fetch_orders(
    start: datetime, end: datetime,
    payment_method: Optional[str], order_status: Optional[str], category: Optional[str],
) -> list:
    query: dict = {"created_at": {"$gte": start, "$lt": end}}
    if payment_method:
        query["payment_method"] = payment_method
    if order_status:
        query["status"] = order_status
    if category:
        product_ids = await _resolve_category_product_ids(category)
        query["items.product_id"] = {"$in": product_ids}
    cursor = orders_collection.find(query)
    return await cursor.to_list(length=20000)


def _revenue_and_order_series(orders: list) -> list:
    by_day: dict = {}
    for o in orders:
        created_at = _ensure_utc(o.get("created_at"))
        if not created_at:
            continue
        day = created_at.strftime("%Y-%m-%d")
        entry = by_day.setdefault(day, {"revenue": 0.0, "orders": 0})
        entry["revenue"] += o.get("total", 0) or 0
        entry["orders"] += 1
    return [
        {"date": d, "revenue": round(v["revenue"], 2), "orders": v["orders"]}
        for d, v in sorted(by_day.items())
    ]


async def compute_kpis(
    start: datetime, end: datetime,
    payment_method: Optional[str], order_status: Optional[str], category: Optional[str],
) -> dict:
    """Just the headline numbers for a range — used to compute previous-period deltas cheaply."""
    start, end = _ensure_utc(start), _ensure_utc(end)
    orders = await _fetch_orders(start, end, payment_method, order_status, category)
    non_cancelled = [o for o in orders if o.get("status") != "cancelled"]
    revenue = sum(o.get("total", 0) or 0 for o in non_cancelled)
    order_count = len(non_cancelled)
    aov = revenue / order_count if order_count else 0
    unique_customers = len({o.get("user_id") for o in non_cancelled if o.get("user_id")})
    return {
        "revenue": revenue, "orders": order_count, "aov": aov,
        "unique_customers": unique_customers, "cancelled": len(orders) - len(non_cancelled),
    }


async def compute_analytics(
    start: datetime, end: datetime,
    payment_method: Optional[str] = None, order_status: Optional[str] = None, category: Optional[str] = None,
) -> dict:
    start, end = _ensure_utc(start), _ensure_utc(end)

    orders = await _fetch_orders(start, end, payment_method, order_status, category)
    non_cancelled = [o for o in orders if o.get("status") != "cancelled"]
    cancelled = [o for o in orders if o.get("status") == "cancelled"]

    revenue = sum(o.get("total", 0) or 0 for o in non_cancelled)
    order_count = len(non_cancelled)
    aov = revenue / order_count if order_count else 0
    customer_ids = {o.get("user_id") for o in non_cancelled if o.get("user_id")}

    # ---- Previous equal-length period, for % change ----
    period_len = end - start
    prev_start, prev_end = start - period_len, start
    prev = await compute_kpis(prev_start, prev_end, payment_method, order_status, category)

    # ---- Repeat customers within range (aggregation, not a Python loop over all orders) ----
    repeat_customers = 0
    if customer_ids:
        counts_cursor = orders_collection.aggregate([
            {"$match": {"user_id": {"$in": list(customer_ids)}, "status": {"$ne": "cancelled"}}},
            {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
        ])
        counts = await counts_cursor.to_list(length=len(customer_ids) or 1)
        repeat_customers = sum(1 for c in counts if c.get("count", 0) > 1)

    # ---- COD outstanding (in-memory, already have non_cancelled) ----
    cod_pending_amount = sum(
        o.get("total", 0) or 0
        for o in non_cancelled
        if o.get("payment_method") == "COD" and o.get("payment_status") != "paid"
    )

    # ---- COD collected today — aggregation pipeline, NOT a Python sum() over an
    # async cursor/generator (`sum(x async for x in cursor)` is invalid —
    # sum() iterates synchronously and can't drive an async generator, which
    # is what raised "'async_generator' object is not iterable" previously).
    # A $group aggregation also avoids pulling full documents into memory
    # just to add up one field.
    today_start = _ensure_utc(datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0))
    cod_collected_cursor = orders_collection.aggregate([
        {"$match": {
            "payment_method": "COD",
            "payment_status": "paid",
            "payment_collected_at": {"$gte": today_start},
        }},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ])
    cod_collected_docs = await cod_collected_cursor.to_list(length=1)
    cod_collected_today = cod_collected_docs[0]["total"] if cod_collected_docs else 0

    # ---- Active deliveries (point-in-time, not range-bound) ----
    active_deliveries = await orders_collection.count_documents({"status": {"$in": ACTIVE_DELIVERY_STATUSES}})

    # ---- Revenue/orders time series ----
    series = _revenue_and_order_series(non_cancelled)

    # ---- Category sales distribution ----
    all_product_ids = {item.get("product_id") for o in non_cancelled for item in o.get("items", []) if item.get("product_id")}
    products_cursor = products_collection.find({"_id": {"$in": list(all_product_ids)}}, {"category_id": 1})
    products = await products_cursor.to_list(length=len(all_product_ids) or 1)
    product_category = {p["_id"]: p.get("category_id") for p in products}

    categories_cursor = categories_collection.find({}, {"name": 1})
    categories = await categories_cursor.to_list(length=1000)
    category_name_map = {c["_id"]: c.get("name", "Unnamed") for c in categories}

    category_totals: dict = {}
    for o in non_cancelled:
        for item in o.get("items", []):
            cat_id = product_category.get(item.get("product_id"))
            cat_name = category_name_map.get(cat_id, "Uncategorized")
            entry = category_totals.setdefault(cat_name, {"qty": 0, "revenue": 0.0})
            entry["qty"] += item.get("quantity", 0) or 0
            entry["revenue"] += item.get("line_total", 0) or 0
    category_sales = [
        {"name": name, "qty": v["qty"], "revenue": round(v["revenue"], 2),
         "pct": round((v["revenue"] / revenue) * 100, 1) if revenue else 0}
        for name, v in sorted(category_totals.items(), key=lambda x: x[1]["revenue"], reverse=True)
    ]

    # ---- Payment analytics ----
    payment_buckets = {
        "online_paid": {"count": 0, "amount": 0.0},
        "cod": {"count": 0, "amount": 0.0},
        "pending": {"count": 0, "amount": 0.0},
    }
    for o in non_cancelled:
        total = o.get("total", 0) or 0
        if o.get("payment_method") == "COD":
            payment_buckets["cod"]["count"] += 1
            payment_buckets["cod"]["amount"] += total
        elif o.get("payment_status") == "paid":
            payment_buckets["online_paid"]["count"] += 1
            payment_buckets["online_paid"]["amount"] += total
        else:
            payment_buckets["pending"]["count"] += 1
            payment_buckets["pending"]["amount"] += total
    for b in payment_buckets.values():
        b["amount"] = round(b["amount"], 2)

    # ---- Order status summary ----
    status_summary: dict = {}
    for o in orders:
        status = o.get("status", "unknown")
        status_summary[status] = status_summary.get(status, 0) + 1

    # ---- Customer insights ----
    customer_docs_cursor = users_collection.find({"_id": {"$in": list(customer_ids)}}, {"name": 1})
    customer_docs = await customer_docs_cursor.to_list(length=len(customer_ids) or 1)
    customer_created = {c["_id"]: c for c in customer_docs}

    # A customer counts as "new" if this is their first-ever order falling inside the range.
    new_customer_count = 0
    if customer_ids:
        first_order_cursor = orders_collection.aggregate([
            {"$match": {"user_id": {"$in": list(customer_ids)}, "status": {"$ne": "cancelled"}}},
            {"$group": {"_id": "$user_id", "first_order": {"$min": "$created_at"}}},
        ])
        first_orders = await first_order_cursor.to_list(length=len(customer_ids) or 1)
        for f in first_orders:
            first_order_at = _ensure_utc(f.get("first_order"))
            if first_order_at and start <= first_order_at < end:
                new_customer_count += 1

    returning_customer_count = len(customer_ids) - new_customer_count
    retention_rate = round((returning_customer_count / len(customer_ids)) * 100, 1) if customer_ids else 0
    avg_orders_per_customer = round(order_count / len(customer_ids), 2) if customer_ids else 0

    # ---- Top customers (by spend, within range) ----
    spend_by_customer: dict = {}
    orders_by_customer: dict = {}
    last_order_by_customer: dict = {}
    for o in non_cancelled:
        uid = o.get("user_id")
        if not uid:
            continue
        total = o.get("total", 0) or 0
        created_at = _ensure_utc(o.get("created_at"))
        spend_by_customer[uid] = spend_by_customer.get(uid, 0) + total
        orders_by_customer[uid] = orders_by_customer.get(uid, 0) + 1
        if created_at and (uid not in last_order_by_customer or created_at > last_order_by_customer[uid]):
            last_order_by_customer[uid] = created_at

    top_customers = []
    for uid, spent in sorted(spend_by_customer.items(), key=lambda x: x[1], reverse=True)[:10]:
        cdoc = customer_created.get(uid)
        top_customers.append({
            "user_id": uid,
            "name": cdoc.get("name", "Unknown") if cdoc else "Unknown",
            "order_count": orders_by_customer.get(uid, 0),
            "total_spent": round(spent, 2),
            "last_order_at": last_order_by_customer.get(uid),
        })
    highest_spender = top_customers[0] if top_customers else None

    # ---- Low stock products ----
    low_stock_cursor = products_collection.find(
        {"stock": {"$lte": LOW_STOCK_THRESHOLD}},
        {"name": 1, "image": 1, "stock": 1},
    ).sort("stock", 1).limit(10)
    low_stock_docs = await low_stock_cursor.to_list(length=10)
    low_stock_products = [
        {
            "id": p["_id"], "name": p.get("name", "Unnamed"), "image": p.get("image"),
            "stock": p.get("stock", 0),
            "status": "Out of stock" if p.get("stock", 0) == 0 else "Critical" if p.get("stock", 0) <= 2 else "Low",
        }
        for p in low_stock_docs
    ]

    # ---- Recent orders ----
    recent_cursor = orders_collection.find(
        {}, {"order_number": 1, "user_id": 1, "total": 1, "status": 1, "payment_status": 1, "created_at": 1},
    ).sort("created_at", -1).limit(8)
    recent_docs = await recent_cursor.to_list(length=8)
    recent_customer_ids = {d.get("user_id") for d in recent_docs if d.get("user_id")}
    recent_customers_cursor = users_collection.find({"_id": {"$in": list(recent_customer_ids)}}, {"name": 1})
    recent_customers = await recent_customers_cursor.to_list(length=len(recent_customer_ids) or 1)
    recent_customer_map = {c["_id"]: c.get("name", "Unknown") for c in recent_customers}
    recent_orders = [
        {
            "id": d["_id"], "order_number": d.get("order_number", ""),
            "customer_name": recent_customer_map.get(d.get("user_id"), "Unknown"),
            "total": d.get("total", 0), "status": d.get("status", "unknown"),
            "payment_status": d.get("payment_status", "pending"),
            "created_at": _ensure_utc(d.get("created_at")),
        }
        for d in recent_docs
    ]

    # ---- Delivery analytics ----
    delivered_in_range = [o for o in non_cancelled if o.get("status") == "delivered"]
    delivery_durations = []
    for o in delivered_in_range:
        out_at, delivered_at = None, None
        for event in o.get("timeline", []):
            event_status = event.get("status")
            event_at = _ensure_utc(event.get("at"))
            if event_status == "out_for_delivery" and out_at is None:
                out_at = event_at
            if event_status == "delivered":
                delivered_at = event_at
        if out_at and delivered_at and delivered_at > out_at:
            delivery_durations.append((delivered_at - out_at).total_seconds() / 60)

    delivery_analytics = {
        "active_deliveries": active_deliveries,
        "delivered_count": len(delivered_in_range),
        "avg_delivery_minutes": round(sum(delivery_durations) / len(delivery_durations), 1) if delivery_durations else None,
        "fastest_delivery_minutes": round(min(delivery_durations), 1) if delivery_durations else None,
        "delayed_count": sum(1 for d in delivery_durations if d > ON_TIME_THRESHOLD_MINUTES),
        "on_time_pct": (
            round((sum(1 for d in delivery_durations if d <= ON_TIME_THRESHOLD_MINUTES) / len(delivery_durations)) * 100, 1)
            if delivery_durations else None
        ),
    }

    return {
        "range": {"from": start.date().isoformat(), "to": (end - timedelta(seconds=1)).date().isoformat()},
        "kpis": {
            "revenue": {"value": round(revenue, 2), "change_pct": _pct_change(revenue, prev["revenue"])},
            "orders": {"value": order_count, "change_pct": _pct_change(order_count, prev["orders"])},
            "average_order_value": {"value": round(aov, 2), "change_pct": _pct_change(aov, prev["aov"])},
            "unique_customers": {"value": len(customer_ids), "change_pct": _pct_change(len(customer_ids), prev["unique_customers"])},
            "repeat_customers": {"value": repeat_customers, "change_pct": None},
            "active_deliveries": {"value": active_deliveries, "change_pct": None},
            "cancelled_orders": {"value": len(cancelled), "change_pct": _pct_change(len(cancelled), prev["cancelled"])},
            "cod_pending_amount": {"value": round(cod_pending_amount, 2), "change_pct": None},
            "cod_collected_today": {"value": round(cod_collected_today, 2), "change_pct": None},
        },
        "revenue_orders_series": series,
        "category_sales": category_sales,
        "payment_analytics": payment_buckets,
        "order_status_summary": status_summary,
        "customer_insights": {
            "new_customers": new_customer_count,
            "returning_customers": returning_customer_count,
            "retention_rate": retention_rate,
            "avg_orders_per_customer": avg_orders_per_customer,
            "highest_spender": highest_spender,
        },
        "top_customers": top_customers,
        "low_stock_products": low_stock_products,
        "recent_orders": recent_orders,
        "delivery_analytics": delivery_analytics,
    }