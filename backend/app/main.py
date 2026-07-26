import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import init_indexes
from app.routers import (
    auth,
    categories,
    products,
    cart,
    orders,
    users,
    admin,
    payment,
    delivery,
    push,
)


app = FastAPI(
    title="Katlkar Dairy API",
    version="0.1.0",
    description="Backend API for Katlkar Dairy ecommerce platform",
)


# -----------------------------
# CORS
# -----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# Static uploads
# -----------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "..", "uploads")

os.makedirs(UPLOAD_DIR, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=UPLOAD_DIR),
    name="uploads",
)


# -----------------------------
# Root + Health
# -----------------------------
@app.get("/")
async def root():
    return {
        "name": "Katlkar Dairy API",
        "status": "running",
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "katlkar-dairy-backend",
    }


# -----------------------------
# API Routers
# -----------------------------
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


# -----------------------------
# Startup
# -----------------------------
@app.on_event("startup")
async def on_startup():
    await init_indexes()


# -----------------------------
# Debug route (temporary)
# Remove after fixing deployment
# -----------------------------
@app.get("/debug/routes")
async def debug_routes():
    return [
        {
            "path": route.path,
            "methods": list(route.methods),
        }
        for route in app.routes
    ]
