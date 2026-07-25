"""
Populates MongoDB with real data in every collection the app uses:
users, categories, products, carts, orders. Run with:

    python -m app.seed
"""
import asyncio
import uuid
from datetime import datetime, timezone

from app.database import (
    categories_collection, products_collection, users_collection,
    carts_collection, orders_collection, init_indexes,
)
from app.security import hash_password


CATEGORIES = [
    {"name": "Milk", "slug": "milk", "icon": "🥛", "sort_order": 1},
    {"name": "Curd & Yogurt", "slug": "curd-yogurt", "icon": "🍶", "sort_order": 2},
    {"name": "Paneer & Cheese", "slug": "paneer-cheese", "icon": "🧀", "sort_order": 3},
    {"name": "Ghee & Butter", "slug": "ghee-butter", "icon": "🧈", "sort_order": 4},
    {"name": "Eggs & Bread", "slug": "eggs-bread", "icon": "🥚", "sort_order": 5},
    {"name": "Sweets", "slug": "sweets", "icon": "🍮", "sort_order": 6},
]

PRODUCTS = [
    {"name": "Full Cream Milk", "category": "milk", "price": 32, "mrp": 34, "unit": "500 ml", "stock": 120,
     "description": "Farm-fresh full cream milk, pasteurized and packed daily.", "tags": ["bestseller"]},
    {"name": "Toned Milk", "category": "milk", "price": 27, "mrp": 29, "unit": "500 ml", "stock": 150,
     "description": "Light, everyday toned milk with balanced fat content.", "tags": []},
    {"name": "A2 Cow Milk", "category": "milk", "price": 65, "mrp": 70, "unit": "1 L", "stock": 60,
     "description": "Premium A2 milk from indigenous cow breeds.", "tags": ["premium"]},
    {"name": "Plain Curd", "category": "curd-yogurt", "price": 30, "mrp": 32, "unit": "400 g", "stock": 90,
     "description": "Thick, creamy curd set the traditional way.", "tags": ["bestseller"]},
    {"name": "Greek Yogurt", "category": "curd-yogurt", "price": 60, "mrp": 65, "unit": "200 g", "stock": 40,
     "description": "High-protein strained yogurt, plain and unsweetened.", "tags": []},
    {"name": "Fresh Paneer", "category": "paneer-cheese", "price": 90, "mrp": 95, "unit": "200 g", "stock": 55,
     "description": "Soft, fresh paneer made in-house every morning.", "tags": ["bestseller"]},
    {"name": "Processed Cheese Slices", "category": "paneer-cheese", "price": 110, "mrp": 120, "unit": "200 g",
     "stock": 35, "description": "Ready-to-use cheese slices for sandwiches and burgers.", "tags": []},
    {"name": "Cow Ghee", "category": "ghee-butter", "price": 320, "mrp": 340, "unit": "500 ml", "stock": 25,
     "description": "Traditional bilona-method cow ghee, rich aroma.", "tags": ["premium"]},
    {"name": "Salted Butter", "category": "ghee-butter", "price": 55, "mrp": 58, "unit": "100 g", "stock": 70,
     "description": "Creamy salted table butter.", "tags": []},
    {"name": "Farm Eggs (6 pcs)", "category": "eggs-bread", "price": 42, "mrp": 45, "unit": "6 pcs", "stock": 80,
     "description": "Free-range farm eggs, rich in protein.", "tags": []},
    {"name": "Brown Bread", "category": "eggs-bread", "price": 40, "mrp": 42, "unit": "400 g", "stock": 45,
     "description": "Soft whole-wheat brown bread, baked fresh.", "tags": []},
    {"name": "Gulab Jamun (Box)", "category": "sweets", "price": 150, "mrp": 160, "unit": "250 g", "stock": 20,
     "description": "Soft milk-solid dumplings soaked in sugar syrup.", "tags": ["festive"]},
]


async def seed():
    print("Creating collections + indexes...")
    await init_indexes()
    print("  users, categories, products, carts, orders — indexes ready")

    print("Seeding categories...")
    slug_to_id = {}
    for c in CATEGORIES:
        existing = await categories_collection.find_one({"slug": c["slug"]})
        if existing:
            slug_to_id[c["slug"]] = existing["_id"]
            continue
        cat_id = str(uuid.uuid4())
        await categories_collection.insert_one({"_id": cat_id, **c})
        slug_to_id[c["slug"]] = cat_id
    print(f"  {len(slug_to_id)} categories ready")

    print("Seeding products...")
    count = 0
    product_ids_by_slug = {}
    for p in PRODUCTS:
        slug = p["name"].lower().replace(" ", "-").replace("(", "").replace(")", "")
        existing = await products_collection.find_one({"slug": slug})
        if existing:
            product_ids_by_slug[slug] = existing["_id"]
            continue
        product_id = str(uuid.uuid4())
        doc = {
            "_id": product_id,
            "name": p["name"],
            "slug": slug,
            "description": p["description"],
            "category_id": slug_to_id[p["category"]],
            "price": p["price"],
            "mrp": p["mrp"],
            "unit": p["unit"],
            "image": None,
            "stock": p["stock"],
            "is_available": True,
            "gst_percent": 0,
            "tags": p["tags"],
        }
        await products_collection.insert_one(doc)
        product_ids_by_slug[slug] = product_id
        count += 1
    print(f"  {count} new products inserted")

    print("Seeding admin account...")
    admin_email = "admin@katlkardairy.com"
    existing_admin = await users_collection.find_one({"email": admin_email})
    if existing_admin:
        admin_id = existing_admin["_id"]
        print("  Admin account already exists")
    else:
        admin_id = str(uuid.uuid4())
        await users_collection.insert_one({
            "_id": admin_id,
            "name": "Katlkar Dairy Admin",
            "email": admin_email,
            "phone": "9999999999",
            "password_hash": hash_password("Admin@123"),
            "addresses": [],
            "role": "admin",
        })
        await carts_collection.insert_one({"user_id": admin_id, "items": []})
        print(f"  Admin created — login with {admin_email} / Admin@123 (change this password!)")

    print("Seeding demo customer...")
    customer_email = "demo.customer@example.com"
    existing_customer = await users_collection.find_one({"email": customer_email})
    if existing_customer:
        customer_id = existing_customer["_id"]
        print("  Demo customer already exists")
    else:
        customer_id = str(uuid.uuid4())
        demo_address = {
            "label": "Home", "line1": "12 MG Road", "line2": "Near City Bus Stand",
            "city": "Nagpur", "pincode": "440001", "lat": 21.1458, "lng": 79.0882,
        }
        await users_collection.insert_one({
            "_id": customer_id,
            "name": "Demo Customer",
            "email": customer_email,
            "phone": "9876543210",
            "password_hash": hash_password("Customer@123"),
            "addresses": [demo_address],
            "role": "customer",
        })
        print(f"  Demo customer created — login with {customer_email} / Customer@123")

    print("Seeding demo customer's cart...")
    milk_id = product_ids_by_slug.get("full-cream-milk")
    curd_id = product_ids_by_slug.get("plain-curd")
    existing_cart = await carts_collection.find_one({"user_id": customer_id})
    if not existing_cart and milk_id and curd_id:
        await carts_collection.insert_one({
            "user_id": customer_id,
            "items": [{"product_id": milk_id, "quantity": 2}, {"product_id": curd_id, "quantity": 1}],
        })
        print("  Cart seeded with 2x Full Cream Milk, 1x Plain Curd")
    else:
        print("  Cart already exists or products missing — skipped")

    print("Seeding demo delivery partner...")
    partner_email = "demo.partner@example.com"
    existing_partner = await users_collection.find_one({"email": partner_email})
    if existing_partner:
        partner_id = existing_partner["_id"]
        print("  Demo delivery partner already exists")
    else:
        partner_id = str(uuid.uuid4())
        await users_collection.insert_one({
            "_id": partner_id,
            "name": "Ravi Kumar",
            "email": partner_email,
            "phone": "9812345670",
            "password_hash": hash_password("Partner@123"),
            "addresses": [],
            "role": "delivery_partner",
        })
        print(f"  Delivery partner created — login with {partner_email} / Partner@123")

    print("Seeding a demo order...")
    existing_order = await orders_collection.find_one({"user_id": customer_id})
    if existing_order:
        print("  Demo order already exists")
    elif milk_id and curd_id:
        milk = await products_collection.find_one({"_id": milk_id})
        curd = await products_collection.find_one({"_id": curd_id})
        now = datetime.now(timezone.utc)
        subtotal = round(milk["price"] * 2 + curd["price"] * 1, 2)
        delivery_fee = 0.0 if subtotal >= 299 else 25.0
        await orders_collection.insert_one({
            "_id": str(uuid.uuid4()),
            "order_number": "KD100001",
            "user_id": customer_id,
            "items": [
                {"product_id": milk_id, "name": milk["name"], "unit": milk["unit"],
                 "price": milk["price"], "quantity": 2, "line_total": round(milk["price"] * 2, 2)},
                {"product_id": curd_id, "name": curd["name"], "unit": curd["unit"],
                 "price": curd["price"], "quantity": 1, "line_total": curd["price"]},
            ],
            "subtotal": subtotal,
            "delivery_fee": delivery_fee,
            "total": round(subtotal + delivery_fee, 2),
            "address": {
                "label": "Home", "line1": "12 MG Road", "line2": "Near City Bus Stand",
                "city": "Nagpur", "pincode": "440001", "lat": 21.1458, "lng": 79.0882,
            },
            "payment_method": "COD",
            "payment_status": "pending",
            "status": "packed",
            "timeline": [{"status": "placed", "at": now}, {"status": "packed", "at": now}],
            "notes": None,
            "created_at": now,
            "delivery_partner_id": partner_id,
            "delivery_partner_name": "Ravi Kumar",
            "delivery_partner_phone": "9812345670",
        })
        print("  Demo order KD100001 created and assigned to Ravi Kumar (delivery partner)")
    else:
        print("  Skipped — seed products first")

    print("\nSeeding complete. Collections populated: users, categories, products, carts, orders.")


if __name__ == "__main__":
    asyncio.run(seed())
