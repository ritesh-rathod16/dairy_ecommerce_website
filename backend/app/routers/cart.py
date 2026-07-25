from fastapi import APIRouter, Depends, HTTPException

from app.database import carts_collection, products_collection
from app.models.cart import CartItemIn, CartOut, CartItemOut
from app.security import get_current_user
from app.config import settings

router = APIRouter(prefix="/api/cart", tags=["cart"])


async def _build_cart_out(user_id: str) -> CartOut:
    cart = await carts_collection.find_one({"user_id": user_id})
    items = cart.get("items", []) if cart else []

    product_ids = [i["product_id"] for i in items]
    products = await products_collection.find({"_id": {"$in": product_ids}}).to_list(length=len(product_ids) or 1)
    product_map = {p["_id"]: p for p in products}

    out_items: list[CartItemOut] = []
    subtotal = 0.0
    for i in items:
        p = product_map.get(i["product_id"])
        if not p:
            continue
        line_total = round(p["price"] * i["quantity"], 2)
        subtotal += line_total
        out_items.append(CartItemOut(
            product_id=p["_id"], name=p["name"], image=p.get("image"),
            unit=p["unit"], price=p["price"], quantity=i["quantity"],
            line_total=line_total, stock=p.get("stock", 0),
            is_available=p.get("is_available", True),
        ))

    delivery_fee = 0.0 if subtotal >= settings.free_delivery_limit or subtotal == 0 else 25.0
    total = round(subtotal + delivery_fee, 2)

    return CartOut(
        items=out_items, subtotal=round(subtotal, 2), delivery_fee=delivery_fee,
        total=total, free_delivery_limit=settings.free_delivery_limit,
    )


@router.get("", response_model=CartOut)
async def get_cart(user=Depends(get_current_user)):
    return await _build_cart_out(user["_id"])


@router.post("/items", response_model=CartOut)
async def add_item(payload: CartItemIn, user=Depends(get_current_user)):
    product = await products_collection.find_one({"_id": payload.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if not product.get("is_available", True):
        raise HTTPException(status_code=400, detail="Product is currently unavailable")
    if payload.quantity > product.get("stock", 0):
        raise HTTPException(status_code=400, detail=f"Only {product.get('stock', 0)} left in stock")

    cart = await carts_collection.find_one({"user_id": user["_id"]})
    items = cart.get("items", []) if cart else []

    for i in items:
        if i["product_id"] == payload.product_id:
            i["quantity"] = payload.quantity
            break
    else:
        items.append({"product_id": payload.product_id, "quantity": payload.quantity})

    await carts_collection.update_one(
        {"user_id": user["_id"]}, {"$set": {"items": items}}, upsert=True
    )
    return await _build_cart_out(user["_id"])


@router.delete("/items/{product_id}", response_model=CartOut)
async def remove_item(product_id: str, user=Depends(get_current_user)):
    cart = await carts_collection.find_one({"user_id": user["_id"]})
    items = [i for i in cart.get("items", [])] if cart else []
    items = [i for i in items if i["product_id"] != product_id]

    await carts_collection.update_one(
        {"user_id": user["_id"]}, {"$set": {"items": items}}, upsert=True
    )
    return await _build_cart_out(user["_id"])


@router.delete("", response_model=CartOut)
async def clear_cart(user=Depends(get_current_user)):
    await carts_collection.update_one(
        {"user_id": user["_id"]}, {"$set": {"items": []}}, upsert=True
    )
    return await _build_cart_out(user["_id"])
