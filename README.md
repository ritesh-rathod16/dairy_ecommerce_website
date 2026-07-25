# Katlkar Dairy — Full Storefront + Admin + Delivery (v10, Delivery Module Complete)

A working full-stack dairy/grocery delivery platform: customer storefront,
a professional desktop admin dashboard with a full BI analytics page and
live delivery tracking, a complete delivery-partner app (stage-by-stage
workflow, embedded maps, split cash/UPI collection, stats/history), real
UPI QR-code payment, Google Maps integration (server geocoding + optional
browser-side live maps), free Web Push notifications, email notification
hooks, Hindi/Marathi language support, and PWA installability. Runs
directly with Python/Node — no Docker.

## v10 — Delivery module completion

All eight remaining delivery-module pieces, built together since they're
interdependent:

**1. Embedded maps, with a real fallback strategy.** `MapEmbed` renders a
real, interactive Google Map (store/customer/rider markers + a driving
route via the Directions API) if `VITE_GOOGLE_MAPS_API_KEY` is set. If it's
not — which is the case out of the box, since only the server-side
Geocoding key was configured — it automatically falls back to the same
free OpenStreetMap embed already used elsewhere, so the feature works
today either way and upgrades automatically the moment you add a browser
key. No broken map, no fake placeholder.

**2. Auto-geocoding, done once, not repeatedly.** If an order has no saved
GPS coordinates when a partner opens its map, the backend now geocodes the
saved address once and persists the result onto the order — every
subsequent view uses the stored value. The old "no GPS coordinates"
warning message is gone in the case where geocoding succeeds; it only
shows if the address genuinely can't be located.

**3. Separate Navigate-to-Store / Navigate-to-Customer buttons** — both
key-free Google Maps deep links, shown in the map panel.

**4–5. Full 9-stage timestamped workflow**, manually advanced by the
partner: Assigned → Accepted → Heading to Store → Reached Store → Packed
→ Picked Up → Heading to Customer → Reached Customer → Delivered. Every
transition is timestamped (`delivery_stage_timeline`). Deliberately kept
as a field *parallel* to the existing coarse `status` (placed/confirmed/
packed/out_for_delivery/delivered/cancelled) rather than replacing it —
synced automatically at the two points that matter (picked up →
out_for_delivery, delivered → delivered) — so the admin dashboard,
analytics, and customer tracking that already depend on `status` keep
working unchanged.

**6. Split Cash / UPI collection**, both hitting one audit-logged backend
path so there's a single source of truth rather than two divergent ones.
"Cash Received" marks paid immediately; "Confirm UPI Received" shows the
same checkout QR (not regenerated) then marks paid. `payment_collection_method`
is now visible to admin and customer.

**7. Delivery partner dashboard + profile** — today's completed/pending
counts, cash/UPI collected today, pending payment total, this
week/month/all-time completed, average and fastest delivery time (computed
from real out_for_delivery→delivered timestamps), all on the dashboard
itself alongside the live-location toggle.

**8. Reject-reason modal** — six preset reasons + "Other" with free text,
replacing the old plain `confirm()`. The reason is stored on the order and
included in the admin's push notification. Rejecting is now blocked once
a partner has picked up the order (uses the new stage field, not just the
coarse status), so nothing can be stranded mid-route.

**9. WhatsApp + copy-address quick actions**, alongside the existing
call/navigate buttons.

**10. Delivery history page** (`/delivery/history`) — date-filtered
(today/week/month/custom/all-time), delivered vs. cancelled, with a total
collected for the range.

**11. Dedicated admin live-tracking page** (`/admin/live-tracking`) — every
order currently out for delivery, each with its own embedded map, instead
of only being visible inline per-order inside the Orders list.

**Honesty note on "distance travelled":** the spec asked for it as a stat,
but this app only receives periodic GPS pings, not a continuous route
breadcrumb trail — so there's no real odometry to report. Rather than
show a made-up number, that specific stat isn't included; store→customer
straight-line distance is shown per-delivery instead, where it's accurate.

## v9 — Analytics BI Dashboard (full rebuild, not incremental)

The whole `/admin/analytics` page and its backend were rebuilt — this
wasn't a patch on top of the old one, since the response shape changed
completely (the old page would have broken against the new API, so both
were rebuilt together and verified against each other).

**KPI cards** (8): Revenue, Orders, Avg Order Value, Unique Customers,
Repeat Customers, Active Deliveries, Cancelled Orders, COD Pending —
each with a real period-over-period % change (vs. the equal-length
previous period), green/red trend arrows.

**Charts (Recharts, not manually-drawn bars):** a revenue-trend area
chart, and a dual-axis line chart comparing orders vs. revenue over the
same range — to see whether more orders are actually producing
proportional revenue.

**Business panels:** Low Stock Products (replaces the old "worst
sellers," which wasn't actionable — this is), a category-sales donut
chart (revenue + qty + % per category), a payment-method donut (Online
paid / COD / Pending, with amounts), an order-status summary with
progress bars, customer insights (new vs. returning, retention rate, avg
orders/customer, highest spender), a Top Customers panel, Recent Orders,
and delivery analytics (avg delivery time, fastest delivery, on-time %
computed from real timeline timestamps — out-for-delivery → delivered).

**Filters:** date presets (Today/Yesterday/Last 7/30/90 days/This year)
plus custom range, and — new — payment method, order status, and category
filters, all combinable and all respected by exports.

**Exports:** PDF (reportlab) and Excel (openpyxl, multi-sheet: KPIs,
revenue-by-day, category sales, top customers, order status) — both call
the *exact same* computation function as the on-screen JSON endpoint, so
an export can never show different numbers than what you were looking at.
Print uses the browser's native print with print-specific CSS (filter bar
hidden, no separate PDF pipeline needed for that one).

**Backend architecture note:** all computation lives in
`app/services/analytics.py` as one pure function — the JSON endpoint, PDF
export, and Excel export all call it, so there's one source of truth for
every number instead of three slightly-different reimplementations.

### Update: the "Delivery Map, Tracking, Payment, Dashboard upgrade" spec
mentioned as deferred above **was built in v10** (see the v10 section at
the top of this file) — embedded maps with an automatic free-tier
fallback, auto-geocoding, the full stage workflow, split Cash/UPI
collection, the delivery dashboard/history, and the reject-reason modal
are all in now.

## v8 — Root-cause fixes + COD payment collection + Danger Zone hardening

**Root-cause fix: product images missing from Cart/Checkout/Orders/Admin/Delivery.**
Traced this rather than patching symptoms: `OrderItemOut` (the snapshot taken
of each product at checkout) never had an `image` field at all — so no
order-based view could *ever* show images, regardless of any frontend fix,
because the data plain didn't exist once an order was placed. Fixed at the
source: the image is now captured into the order snapshot at checkout time,
and displayed consistently on Home, Product detail, Cart, Order history,
Admin order view, and Delivery partner view — all through the same
`resolveImageUrl()` helper, so there's one code path, not five slightly
different ones. A placeholder (🥛) shows wherever an image is genuinely
absent, so the layout never breaks.

**Danger Zone — investigated, and fixed what was actually wrong.** I traced
through every delete endpoint and the dashboard/analytics aggregations line
by line. The specific bug reported — "Delete Orders deletes unrelated data",
"dashboard shows blank/undefined after deletion" — doesn't reproduce in this
codebase: each delete endpoint only ever touches its own collection, and
every aggregation already had a zero/empty-list fallback for empty data. I
did find and fix two real, related bugs while checking:
- Bulk-deleting **categories** left products with a dangling `category_id`
  pointing at nothing. Now nulls it out — products become "uncategorized"
  instead of referencing a ghost category. (`category_id` is now optional
  on the product model to support this.)
- Bulk-deleting **customers** didn't clean up their carts — orphaned cart
  documents were left behind indefinitely. Now cleaned up in the same action.
- Added the confirmation-preview from the spec: the delete dialog now shows
  exact counts of what will be deleted/modified/left untouched *before* you
  type DELETE, via a new `GET /admin/danger/preview/{target}` endpoint.

**COD payment collection by delivery partners — real, audited, not a stub.**
- Every delivery order shows a payment method + colored status badge
  (Paid / Unpaid / Pending verification).
- For unpaid orders, the partner sees a **"Collect ₹X"** button that shows
  the *same* QR code used at checkout (reused via a shared `qr.py` service —
  not regenerated with different logic) for the exact outstanding amount.
- **"Mark as Paid"** logs who collected it and when (`payment_collected_by`,
  `payment_collected_at`) via a shared, single-source-of-truth
  `change_payment_status()` helper used by all three payment-status change
  paths (customer self-report, admin verification, delivery collection) —
  so there's one audit-logged implementation, not three divergent ones.
- **Business rule enforced server-side:** marking an order `delivered` while
  unpaid returns `409` with the outstanding amount, unless the request
  explicitly confirms (`confirm_unpaid: true`) — the delivery app surfaces
  this as a confirm dialog rather than silently blocking or silently allowing it.
- Full audit trail (`payment_history`) on every order: who changed the
  status, from what, to what, when — visible to admin.
- Only the assigned delivery partner (or an admin) can change an order's
  payment status — enforced by the existing `delivery_partner_id` ownership
  check on every delivery endpoint.

**Not attempted this pass: the full Analytics BI dashboard overhaul**
(Recharts, KPI cards with period-over-period %, revenue/orders dual-line
chart, payment/product donut charts, top customers, delivery analytics,
PDF/Excel export, custom date-range with 8+ presets). That's a genuinely
large, standalone feature — dozens of new backend aggregation queries and
a new charting dependency — and attempting it in the same pass as three
other fixes risked shipping something shallow. Happy to build it properly
as its own focused pass.

## v7 — Delivery Module overhaul + Web Push

- **Independent admin/delivery sessions (real bug fix)**: previously both
  portals shared one `kd_token` in localStorage — logging into delivery in
  one tab would silently invalidate an admin session open in another tab of
  the same browser. Now each portal (customer/admin/delivery) has its own
  token key, its own axios client, and its own auth context, so all three
  can be logged in simultaneously, in separate tabs, indefinitely.
- **Delivery visibility bug fixed**: `/delivery/my-orders` only returned
  orders already `packed`/`out_for_delivery` — an order assigned while still
  `placed`/`confirmed` was invisible to the partner. Now shows anything
  assigned and not yet finished.
- **Customer info on delivery orders**: name + tap-to-call phone number.
- **Route, ETA, and navigation**: each order card has a "Show route &
  navigate" panel — real distance/ETA (Google Distance Matrix) and
  key-free "Navigate to store" / "Navigate to customer" buttons using
  Google Maps' free deep-link format (`/maps/dir/?api=1&destination=lat,lng`
  — no Maps JavaScript API key needed for this, only your existing server
  Geocoding/Distance Matrix key).
- **Accept/Reject**: a partner can reject an order before pickup, which
  un-assigns them and notifies admins to reassign. Blocked once an order
  is already out for delivery, so nothing gets stranded mid-route.
- **Admin live tracking**: orders that are out for delivery show an
  embedded live map on `/admin/orders` (same key-free OpenStreetMap embed
  used on the customer side), auto-refreshing every 15s.
- **Web Push notifications — real, not stubbed**: free, VAPID-based browser
  push (no third-party service, no per-notification cost). Order placed →
  customer + all admins notified. Status changed → customer notified.
  Partner assigned → that partner notified. Order rejected → admins
  notified. "Enable notifications" buttons live in the admin topbar, the
  delivery dashboard, and the customer Account page. Clicking a
  notification focuses the right tab and navigates to the relevant order.
  A dependency-free Web Audio beep plays for foreground notifications.

### Setting up Web Push

```bash
cd backend && source .venv/bin/activate
python generate_vapid_keys.py
```
Paste the printed `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` into `.env`, set
`VAPID_CLAIMS_EMAIL` to a real contact address (required by the push spec),
restart the backend. Push notifications only work in a **production build**
(`npm run build`) — the service worker that handles them isn't registered
in `npm run dev`, since hot-reload and service workers don't mix well. If
VAPID keys aren't set, push calls are silently skipped (logged, not
raised) — the rest of the app works fine without them.

**Honesty note on this specific script:** I couldn't install packages or run
this in the sandbox that built it, so the key format (raw 32-byte P-256
scalar, base64url) is my best understanding of what `pywebpush` expects,
not something I verified end-to-end. Test it by enabling notifications and
triggering one real event (e.g. place a test order). If sending fails with
a key-format error, regenerate with the `vapid --gen` CLI tool that ships
with `py_vapid` instead — that one's guaranteed correct since it comes from
the library authors — and use its output in `.env` instead.

### What's adapted vs. deferred from the full delivery spec

This is a single-store app, not a multi-vendor marketplace — so "restaurant"
throughout the original spec became "store" (one pickup point, from
`STORE_LAT`/`STORE_LNG`/`STORE_PHONE`/`STORE_ADDRESS` in `.env`), not a
per-order restaurant record. Also deliberately **not** built this pass:
- The full 8-stage status rename (Assigned→Accepted→Heading to Store→
  Arrived→Picked Up→Heading to Customer→Arrived→Delivered) — that's an
  invasive rework of the status enum used throughout the admin dashboard,
  analytics, and seed data. The existing 6-status flow (placed→confirmed→
  packed→out_for_delivery→delivered, or cancelled) covers the same ground
  with less risk of breaking what's already working; Accept/Reject was
  added on top of it instead of replacing it.
- In-app notification center / unread badge counts — push notifications
  work standalone; there's no panel listing notification history yet.
- Duplicate-notification dedup beyond same-tag replacement (browsers
  already replace same-`tag` notifications; finer-grained dedup logic
  isn't implemented).

## Admin Phase 2 — what's new

- **Fixed React hook bug**: four admin pages did `useEffect(load, [deps])`
  where `load` returned a Promise (from a `.then()` chain) — same class of
  issue as `useEffect(async () => ...)`. All four now wrap it in a proper
  `useEffect(() => { load(); }, [deps])`.
- **Redesigned admin shell** — fixed sidebar, sticky topbar with global order
  search, full-width layout, stat cards, mini bar charts. No more `max-w`
  constrained admin pages.
- **Every admin list page** (Products, Categories, Orders) now has real
  loading skeletons, error states with Retry, and empty states — nothing
  renders blank on a failed request anymore.
- **Product images, dual mode** — drag-and-drop or file-picker upload
  (compressed server-side with Pillow, capped at 1200px/JPEG-82%), **or**
  paste an image URL. Both show an instant preview.
- **UPI ID is now admin-editable** — `/admin/settings` → Payment → UPI ID,
  persisted in Mongo, takes effect on the next QR code generated. No `.env`
  edit or redeploy needed.
- **CSV export** — one-click download for Orders, Products, and Users from
  their respective admin pages.
- **Dedicated Analytics page** (`/admin/analytics`) — date-range filters
  (Today/Yesterday/This week/This month/This year/custom), revenue-by-day
  chart, AOV, repeat customers, best/worst sellers, cancelled count.
- **Danger Zone** (`/admin/danger-zone`) — bulk-delete orders/products/
  categories/customers/everything, each gated behind typing `DELETE` to confirm.
- **Change password** — works for every account type (customer, admin, delivery
  partner) via one shared endpoint. Customer: `/account`. Admin: `/admin/settings`.
  Delivery partner: "Account" button on the delivery dashboard.
- **Invoice PDF** — real, downloadable PDF (reportlab), itemized with subtotal/
  delivery fee/total, billing address, and payment status. Customers get a
  "Download invoice" link on their order page; admins get one on every order
  in `/admin/orders`.

## Stack

- **Backend:** FastAPI + MongoDB (Motor) + JWT auth
- **Frontend:** React (Vite) + Tailwind CSS + lucide-react icons
- **Database:** MongoDB Atlas (or any Mongo instance — just set `MONGO_URI`)
- **Payments:** Real server-generated UPI QR code for your own UPI ID (admin-editable) — no gateway needed
- **Maps:** Google Geocoding + Distance Matrix APIs (server-side), browser geolocation (client-side)
- **Email:** SMTP if configured, otherwise logged to console
- **i18n:** English / Hindi / Marathi for the UI chrome
- **Image storage:** local disk (`backend/uploads/`, served at `/uploads/*`) — swap for S3/Cloudinary later if you need CDN-backed images

## Prerequisites

- Python 3.11+ and Node.js 18+ installed locally
- A MongoDB connection string (Atlas works great — that's what `.env.example` assumes)

## 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your real values. The two that matter most:

```dotenv
MONGO_URI=mongodb+srv://<username>:<password>@your-cluster.mongodb.net/?retryWrites=true&w=majority
DATABASE_NAME=your_database_name
```

`DATABASE_NAME` is what selects/creates the database on your cluster — MongoDB
creates a database (and each collection in it) automatically the first time
something is written to it, so you don't need to pre-create it in Atlas.

**Also copy `.env` into `backend/`** — `config.py` loads `.env` relative to
wherever you run `uvicorn` from:
```bash
cp .env backend/.env
```

## 2. Start the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Leave this running. API docs: http://localhost:8000/docs

## 3. Create all collections + seed data (one command)

In a second terminal:

```bash
cd backend
source .venv/bin/activate
python -m app.seed
```

This is the command that "adds all the collections" — it connects to your
`MONGO_URI`/`DATABASE_NAME`, creates every collection the app uses with its
indexes (`users`, `categories`, `products`, `carts`, `orders`), and inserts
real documents into **all five**:

- `categories` — 6 sample categories (Milk, Curd & Yogurt, Paneer & Cheese...)
- `products` — 12 sample products linked to those categories
- `users` — an admin account, a demo customer, and a demo delivery partner (see below)
- `carts` — the demo customer's cart, pre-populated with 2 items
- `orders` — one real sample order (`KD100001`), assigned to the demo delivery partner

Seeded logins:
```
Admin:             admin@katlkardairy.com / Admin@123        → /admin/login
Customer:          demo.customer@example.com / Customer@123  → /login
Delivery partner:  demo.partner@example.com / Partner@123     → /delivery/login
```
**Change the admin password before going live** — there's no change-password UI yet.

You can re-run `python -m app.seed` any time; it skips anything that already exists.

### Verify it actually works end to end

Once the backend is running and seeded, run the automated smoke test instead
of clicking through everything by hand:

```bash
cd backend && source .venv/bin/activate
python smoke_test.py
```

It runs the real flow — register → browse → cart → checkout (COD and
ONLINE) → invoice download → admin login → assign delivery partner →
delivery partner sees the order → delivers it → customer sees the live
update — against your actual server and database, and prints PASS/FAIL for
each step. If everything passes, the core system is genuinely working
together, not just individually compiling.

## 4. Start the frontend

In a third terminal:

```bash
cd frontend
npm install
npm run dev
```

- **Storefront:** http://localhost:5173
- **Admin login:** http://localhost:5173/admin/login (separate from customer login —
  see below)

## Admin login is separate from customer login

`/admin` requires an authenticated session with `role: admin`. If you're not
logged in as an admin, it redirects to **`/admin/login`** — a dedicated,
full-screen staff sign-in page (`frontend/src/admin/AdminLogin.jsx`), distinct
from the customer `/login` page. Signing in there with a non-admin account is
rejected with an explicit error rather than silently logging you into the
storefront. The admin panel also has its own header/logout, independent of
the customer navbar.

## Delivery partner module

A third, separate app for delivery staff — its own login (`/delivery/login`),
own layout, own auth session (independent of admin/customer — see v7 notes above):

1. **Admin creates delivery partner accounts** at `/admin/delivery-partners`
   (name, email, phone, password), and can suspend/reactivate them.
2. **Admin assigns an order to a partner** from `/admin/orders` — a dropdown
   next to each order, which pushes a notification to that partner.
3. **The partner sees customer contact info, route, and ETA** on each
   assigned order — tap-to-call the customer, an expandable route panel with
   real distance/ETA and one-tap navigation to the store or the customer.
4. **Accept implicitly / Reject explicitly** — tapping "Start delivery"
   accepts it; "Reject" un-assigns them (before pickup only) and notifies
   admins to reassign.
5. **Live location sharing** — "Start sharing" uses the browser's real
   `navigator.geolocation.watchPosition` to post coordinates to the backend
   as they update, denormalized onto the order while `out_for_delivery`.
6. **The customer sees it live** on their order page: partner name/phone
   (call link) and a live-updating embedded map (free OpenStreetMap embed,
   no Google Maps key required), refreshed every 15 seconds. **Admins see
   the same live map** on `/admin/orders` for any order out for delivery.

This is real tracking (actual GPS coordinates, actually posted and displayed),
not a simulation — the only thing it doesn't include is a native mobile app;
it works today from any phone's browser.

## How UPI payment works (no gateway)

There's no Razorpay/PhonePe merchant account involved. Instead:

1. The backend generates a real QR code (server-side, via the `qrcode` library)
   encoding a standard `upi://pay?pa=<your UPI ID>&am=<amount>` link.
2. The customer scans it with any UPI app and pays **directly into your bank
   account** — same as any UPI QR code you'd print and stick on a counter.
3. There's no webhook telling the app "money arrived" (that requires a paid
   gateway subscription), so the customer taps "I've completed the payment"
   — this flags the order `pending_verification`, it doesn't mark it paid.
4. You check your UPI app / bank SMS, then mark the order **Paid** from
   `/admin/orders`.

Set your real UPI ID either in `.env` (used as the initial default):
```
UPI_ID=yourname@upi
MERCHANT_NAME=Your Business Name
```
**...or, easier, from the admin panel** at `/admin/settings` — this is stored
in Mongo and takes effect immediately on the next QR code generated, no
redeploy needed. The `.env` value is only the fallback used before you've
saved anything there.

## Configuring integrations

All optional — the app runs fully without them, using honest fallbacks so you
can develop before you have live credentials.

| Integration | Env vars | Behavior when unset |
|---|---|---|
| UPI payment | `UPI_ID`, `MERCHANT_NAME` | Uses the default placeholder UPI ID — set your real one before going live |
| Google Maps | `GOOGLE_MAPS_SERVER_API_KEY` | Delivery-radius check is skipped; address still captured as plain text + optional geolocation |
| Email/SMTP | `SMTP_HOST`, `SMTP_EMAIL`, `SMTP_PASSWORD` | Emails logged to the backend console instead of sent |

**Security note:** `.env` is git-ignored and never committed. Treat any secret
that's ever been pasted into a chat, ticket, or shared doc as compromised —
rotate it in the provider's dashboard before relying on it.

## What's included

**Customer app**
- Registration/login (JWT), server-side persistent cart, product search & categories
- Checkout with COD or online payment (real UPI QR code)
- "Use my current location" (real browser geolocation) captured with the address
- Order history with status timeline, self-service cancellation, payment status
- Installable PWA with an offline-capable app shell
- Language switcher: English / Hindi / Marathi for UI text

**Admin panel** (`/admin`, dedicated login at `/admin/login`)
- Dashboard: revenue, order counts, low-stock alerts, top-selling products
- Product CRUD (create/edit/delete, stock, pricing, availability toggle)
- Category CRUD
- Order management: update status (placed → confirmed → packed → out for
  delivery → delivered), which triggers a customer email + push notification
- Payment verification: mark UPI payments as confirmed after checking your bank/UPI app
- Delivery partner management: create accounts, suspend/reactivate, assign to orders
- Employee management (`/admin/employees`): Manager/Warehouse/Support accounts —
  create, edit, suspend/reactivate, delete. No dedicated portal for these
  roles yet (see "What's still not included")
- Live delivery tracking map on any order that's out for delivery
- Analytics with date-range filters, CSV export, danger-zone bulk deletes

**Delivery partner app** (`/delivery`, dedicated login at `/delivery/login`,
independent session from admin — see v7 notes above)
- See only your own assigned orders, with customer contact info
- Route/ETA panel with one-tap navigation to store or customer
- Accept (implicit via "Start delivery") / Reject (explicit, before pickup)
- Share live GPS location with one tap; customers and admins see it live

**Notifications**
- Free Web Push (VAPID) across all three portals — order placed, status
  changed, partner assigned, delivery rejected
- Email (SMTP or console fallback) alongside push for order confirmations/status

**Backend integrations**
- Real server-generated UPI QR codes (`qrcode` library) — no gateway dependency
- Real Google Maps geocoding + distance-matrix (delivery-radius enforcement,
  route distance/ETA) + key-free navigation deep links
- Email service with real SMTP send or safe console fallback
- Web Push service with real VAPID delivery or safe console fallback

## What's still not included

Deliberately deferred from the full "Admin Dashboard Phase 2" spec — each is
real, standalone scope, not something to fake in a rushed pass:

- **Native delivery-partner mobile app** — the delivery flow works fully in
  a phone browser today; a dedicated app (background location while the
  browser tab isn't active) is a further step, not a requirement to function.
- **Route optimization / multi-stop planning** — partners see their assigned
  orders in a simple list with per-order navigation, not an optimized
  multi-stop route across several orders at once.
- **Dedicated portals for Manager/Warehouse/Support roles** — admin can
  create and manage these accounts (`/admin/employees`), but they have
  nowhere to log in yet; only Admin and Delivery Partner have real dashboards.
- **Customer profile page (Blinkit-style)** — wishlist, wallet, referral
  code, reward points, recently-viewed, saved payment methods don't exist.
  Addresses, orders, change-password, and notification opt-in do (via `/account`).
- **Suggested products / "you may also like"** — not built.
- **In-app notification center / unread badge count** — push notifications
  work standalone; there's no panel listing notification history yet.
- **Global search across all entities** — the topbar search currently
  searches orders by number only, not products/users/employees.
- **Dark mode, keyboard shortcuts, virtualized tables** — UI polish items,
  not started.
- **Granular per-role permissions** (Manager sees X but not Y, etc.) —
  today it's binary: `admin` role or not.
- **Translated product catalog** — i18n covers UI chrome; product names/
  descriptions stay in whatever language you type them in the admin panel.
- **SMS notifications, coupons, wallet/loyalty points, OTP delivery
  verification, Excel (.xlsx) export** — CSV export exists; Excel and the
  rest are straightforward additions on top of this structure.

## Project structure

```
katlkar-dairy/
├── .env.example
├── backend/
│   ├── generate_vapid_keys.py    # run once to enable Web Push
│   └── app/
│       ├── main.py, config.py, database.py, security.py, seed.py
│       ├── models/          # Pydantic schemas
│       ├── routers/          # auth, users, categories, products, cart, orders,
│       │                     # admin, payment, delivery, push
│       └── services/          # email.py, maps.py, invoice.py, settings.py, push.py
└── frontend/src/
    ├── api/                  # client.js (customer), adminClient.js, deliveryClient.js
    ├── context/               # AuthContext (customer), Cart, createAuthContext.jsx (shared factory)
    ├── i18n/                  # LanguageContext + translations
    ├── components/             # Navbar, ProductCard, ProtectedRoute, PaymentSection, ChangePasswordForm
    ├── pages/                  # customer-facing pages, incl. Account.jsx
    ├── utils/                  # download.js, push.js
    ├── admin/                  # AdminAuthContext, AdminLogin, AdminRoute, AdminLayout, admin pages
    └── delivery/                # DeliveryAuthContext, DeliveryLogin, DeliveryRoute, DeliveryDashboard
```

## A note on testing

This was built and reviewed in a sandbox with no internet access and no local
MongoDB — every file was manually checked for syntax and logical correctness
(including scripted checks for bracket balance and Pydantic forward-reference
bugs), but not run end-to-end against your live Atlas cluster or in a real
browser. Web Push in particular has real-world quirks (browser permission
prompts, service worker registration timing) that only show up in an actual
run. Please do a full run-through — seed → sign up → browse → cart → checkout
→ admin login → status update → payment → assign delivery → delivery partner
accept/reject/deliver → enable notifications on all three portals — and tell
me what breaks.
