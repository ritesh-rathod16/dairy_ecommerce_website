import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import init_indexes
from app.routers import auth, categories, products, cart, orders, users, admin, payment, delivery, push

app = FastAPI(title="Katlkar Dairy API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten this to your real frontend origin in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(categories.router)
app.include_router(products.router)
app.include_router(cart.router)
app.include_router(orders.router)
app.include_router(admin.router)
app.include_router(payment.router)
app.include_router(delivery.router)
app.include_router(push.router)


@app.on_event("startup")
async def on_startup():
    await init_indexes()


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "katlkar-dairy-backend"}
