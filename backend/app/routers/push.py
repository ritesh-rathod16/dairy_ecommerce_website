"""
Push subscription management. Shared across all three portals (customer,
admin, delivery) — whoever's Bearer token is presented determines whose
subscription gets stored, so the same endpoints work regardless of which
portal's API client calls them.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.database import push_subscriptions_collection
from app.security import get_current_user
from app.config import settings
from app.services.push import is_configured

router = APIRouter(prefix="/api/push", tags=["push"])


@router.get("/vapid-public-key")
async def vapid_public_key():
    return {"public_key": settings.vapid_public_key or None, "enabled": is_configured()}


class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeIn(BaseModel):
    endpoint: str
    keys: SubscriptionKeys


@router.post("/subscribe")
async def subscribe(payload: SubscribeIn, user=Depends(get_current_user)):
    await push_subscriptions_collection.update_one(
        {"endpoint": payload.endpoint},
        {"$set": {
            "user_id": user["_id"],
            "endpoint": payload.endpoint,
            "keys": payload.keys.model_dump(),
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"ok": True}


class UnsubscribeIn(BaseModel):
    endpoint: str


@router.post("/unsubscribe")
async def unsubscribe(payload: UnsubscribeIn, user=Depends(get_current_user)):
    await push_subscriptions_collection.delete_one({"endpoint": payload.endpoint, "user_id": user["_id"]})
    return {"ok": True}
