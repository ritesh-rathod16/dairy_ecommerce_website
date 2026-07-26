import os
import traceback

from fastapi import FastAPI
from fastapi.responses import JSONResponse
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
    description="Katlkar Dairy Ecommerce Backend API",
)


# -----------------------------
# CORS Configuration
# -----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# Static Uploads
# -----------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_DIR = os.path.join(
    BASE_DIR,
    "..",
    "uploads"
)

UPLOAD_DIR = os.path.abspath(UPLOAD_DIR)

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True
)

app.mount(
    "/uploads",
    StaticFiles(directory=UPLOAD_DIR),
    name="uploads",
)


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
async def startup_event():
    await init_indexes()


# -----------------------------
# Root Endpoint
# -----------------------------
@app.get("/")
async def root():
    return {
        "name": "Katlkar Dairy API",
        "status": "running",
        "docs": "/docs",
        "health": "/api/health",
    }


# -----------------------------
# Health Check
# -----------------------------
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "katlkar-dairy-backend",
    }


# -----------------------------
# Debug Routes
# -----------------------------
@app.get("/debug/routes")
async def debug_routes():

    try:
        routes = []

        for route in app.routes:
            routes.append(
                {
                    "path": getattr(route, "path", None),
                    "name": getattr(route, "name", None),
                    "methods": list(
                        getattr(route, "methods", [])
                    ),
                }
            )

        return {
            "total_routes": len(routes),
            "routes": routes,
        }

    except Exception as e:

        return JSONResponse(
            status_code=500,
            content={
                "error": str(e),
                "trace": traceback.format_exc(),
            },
        )


# -----------------------------
# Global Error Debug Endpoint
# -----------------------------
@app.get("/debug/info")
async def debug_info():
    return {
        "app": app.title,
        "version": app.version,
        "environment": os.getenv("ENVIRONMENT", "production"),
        "python": os.sys.version,
        "upload_dir": UPLOAD_DIR,
    }
