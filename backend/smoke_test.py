"""
End-to-end smoke test — runs the real flow against your actual running
backend (and, implicitly, your real MongoDB) instead of you clicking
through it by hand. Uses httpx, which is already a backend dependency, so
no extra install needed.

Run it with the backend up and seeded:

    cd backend && source .venv/bin/activate
    python -m app.seed          # if you haven't already
    python smoke_test.py

It prints PASS/FAIL for each step and exits non-zero if anything fails,
so you can tell at a glance whether the whole system actually works
together — not just whether each file compiles.

Covers: customer registration → browse → cart → checkout (COD) → invoice
download; a second checkout with ONLINE payment → UPI QR → mark paid;
admin login → dashboard → order visibility → assign delivery partner;
delivery login → sees the newly-assigned order (this is the exact bug
that was fixed earlier — an order assigned while still "placed" used to
be invisible to the partner) → start delivery → mark delivered; customer
sees the delivery-partner info update on their order.
"""
import random
import string
import sys

import httpx

BASE_URL = "http://localhost:8000/api"
ADMIN_EMAIL = "admin@katlkardairy.com"
ADMIN_PASSWORD = "Admin@123"
PARTNER_EMAIL = "demo.partner@example.com"
PARTNER_PASSWORD = "Partner@123"

results = []


def check(label, condition, detail=""):
    status = "PASS" if condition else "FAIL"
    results.append((label, status))
    print(f"[{status}] {label}" + (f" — {detail}" if detail and not condition else ""))
    if not condition:
        print(f"        ^ full detail: {detail}")
    return condition


def random_suffix():
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=6))


def main():
    client = httpx.Client(base_url=BASE_URL, timeout=15)

    # ---- Health check ----
    try:
        r = client.get("/health")
        check("Backend is reachable", r.status_code == 200, r.text)
    except httpx.ConnectError as e:
        print(f"[FAIL] Backend is reachable — {e}")
        print("\nIs the backend actually running on http://localhost:8000 ?")
        sys.exit(1)

    # ---- Customer: register ----
    suffix = random_suffix()
    customer_email = f"smoketest.{suffix}@example.com"
    r = client.post("/auth/register", json={
        "name": "Smoke Test Customer", "email": customer_email,
        "phone": f"9{suffix.ljust(9, '0')[:9]}", "password": "TestPass123",
    })
    if not check("Customer registration", r.status_code == 201, r.text):
        sys.exit(1)
    customer_token = r.json()["access_token"]
    customer_headers = {"Authorization": f"Bearer {customer_token}"}

    # ---- Browse ----
    r = client.get("/categories")
    check("List categories", r.status_code == 200 and len(r.json()) > 0, r.text)

    r = client.get("/products")
    products = r.json().get("items", [])
    if not check("List products", r.status_code == 200 and len(products) > 0, r.text):
        print("No products found — did you run `python -m app.seed`?")
        sys.exit(1)
    product = products[0]

    # ---- Cart ----
    r = client.post("/cart/items", json={"product_id": product["id"], "quantity": 2}, headers=customer_headers)
    check("Add to cart", r.status_code == 200 and len(r.json()["items"]) == 1, r.text)

    r = client.get("/cart", headers=customer_headers)
    cart = r.json()
    check("Cart totals computed", r.status_code == 200 and cart["total"] > 0, r.text)

    # ---- Checkout: COD order ----
    address = {"label": "Home", "line1": "1 Test Street", "city": "Nagpur", "pincode": "440001"}
    r = client.post("/orders", json={"address": address, "payment_method": "COD"}, headers=customer_headers)
    if not check("Place COD order", r.status_code == 201, r.text):
        sys.exit(1)
    order = r.json()
    order_id = order["id"]

    r = client.get(f"/orders/{order_id}", headers=customer_headers)
    check("Fetch order detail", r.status_code == 200, r.text)

    r = client.get(f"/orders/{order_id}/invoice", headers=customer_headers)
    check("Download invoice (PDF)", r.status_code == 200 and r.headers.get("content-type") == "application/pdf", r.text[:200])

    # ---- Checkout: ONLINE order (UPI QR flow) ----
    r = client.post("/cart/items", json={"product_id": product["id"], "quantity": 1}, headers=customer_headers)
    r = client.post("/orders", json={"address": address, "payment_method": "ONLINE"}, headers=customer_headers)
    online_order_ok = check("Place ONLINE order", r.status_code == 201, r.text)
    if online_order_ok:
        online_order_id = r.json()["id"]
        r = client.get(f"/payment/upi-qr/{online_order_id}", headers=customer_headers)
        check("Generate UPI QR code (PNG)", r.status_code == 200 and r.headers.get("content-type") == "image/png", r.text[:200])
        r = client.post(f"/payment/report-paid/{online_order_id}", headers=customer_headers)
        check("Report payment (pending_verification)", r.status_code == 200 and r.json()["payment_status"] == "pending_verification", r.text)

    # ---- Admin ----
    r = client.post("/auth/login-json", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if not check("Admin login", r.status_code == 200, r.text):
        print(f"Seeded admin login failed — check {ADMIN_EMAIL} exists (run the seed script).")
        sys.exit(1)
    admin_token = r.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    r = client.get("/admin/dashboard", headers=admin_headers)
    check("Admin dashboard loads", r.status_code == 200 and "total_orders" in r.json(), r.text)

    r = client.get("/admin/orders", headers=admin_headers)
    admin_orders = r.json()
    order_visible = any(o["id"] == order_id for o in admin_orders)
    check("Admin can see the new order", r.status_code == 200 and order_visible, f"order {order_id} in admin list: {order_visible}")

    if online_order_ok:
        r = client.patch(f"/admin/orders/{online_order_id}/payment-status", json={"payment_status": "paid"}, headers=admin_headers)
        check("Admin verifies UPI payment", r.status_code == 200 and r.json()["payment_status"] == "paid", r.text)

    # ---- Assign delivery partner, then confirm the visibility fix ----
    r = client.get("/admin/delivery-partners", headers=admin_headers)
    partners = r.json()
    if not check("List delivery partners", r.status_code == 200 and len(partners) > 0, r.text):
        print(f"No delivery partners found — did the seed script create {PARTNER_EMAIL}?")
        sys.exit(1)
    partner = partners[0]

    r = client.patch(f"/admin/orders/{order_id}/assign", json={"delivery_partner_id": partner["id"]}, headers=admin_headers)
    check("Assign delivery partner to order (still 'placed')", r.status_code == 200, r.text)

    # ---- Delivery partner ----
    r = client.post("/auth/login-json", json={"email": PARTNER_EMAIL, "password": PARTNER_PASSWORD})
    if not check("Delivery partner login", r.status_code == 200, r.text):
        sys.exit(1)
    delivery_token = r.json()["access_token"]
    delivery_headers = {"Authorization": f"Bearer {delivery_token}"}

    r = client.get("/delivery/my-orders", headers=delivery_headers)
    my_orders = r.json()
    sees_it = any(o["id"] == order_id for o in my_orders)
    check(
        "Partner sees the order despite it still being 'placed' (regression test for the visibility bug)",
        r.status_code == 200 and sees_it,
        f"my-orders: {[o['order_number'] for o in my_orders]}",
    )

    r = client.patch(f"/delivery/orders/{order_id}/status", json={"status": "out_for_delivery"}, headers=delivery_headers)
    check("Partner starts delivery", r.status_code == 200, r.text)

    r = client.post("/delivery/location", json={"lat": 21.15, "lng": 79.09}, headers=delivery_headers)
    check("Partner sends live location", r.status_code == 200, r.text)

    r = client.get(f"/orders/{order_id}", headers=customer_headers)
    order_after = r.json()
    check(
        "Customer sees delivery partner + live location on their order",
        order_after.get("delivery_partner_name") == partner["name"] and order_after.get("delivery_location") is not None,
        str(order_after.get("delivery_location")),
    )

    r = client.patch(f"/delivery/orders/{order_id}/status", json={"status": "delivered"}, headers=delivery_headers)
    check("Partner marks delivered", r.status_code == 200, r.text)

    # ---- Summary ----
    print("\n" + "=" * 50)
    passed = sum(1 for _, s in results if s == "PASS")
    total = len(results)
    print(f"{passed}/{total} checks passed")
    if passed != total:
        print("Some checks failed — see [FAIL] lines above for details.")
        sys.exit(1)
    print("Everything above ran end to end successfully. 🎉")


if __name__ == "__main__":
    main()
