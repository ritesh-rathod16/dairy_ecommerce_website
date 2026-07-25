"""
Browser push notifications via the standard Web Push protocol (VAPID) —
completely free, no third-party service, no per-notification cost. Works
with Chrome, Edge, and Firefox's built-in push infrastructure.

If VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY aren't set in .env, every function
here is a safe no-op (logged, not raised) — the rest of the app keeps
working without push notifications until you generate keys with
`python generate_vapid_keys.py` and add them to .env.
"""
import json
import logging

from pywebpush import webpush, WebPushException

from app.config import settings
from app.database import push_subscriptions_collection, users_collection

logger = logging.getLogger("katlkar.push")


def is_configured() -> bool:
    return bool(settings.vapid_public_key and settings.vapid_private_key)


async def _send_to_subscription(sub_doc: dict, payload: dict) -> bool:
    try:
        webpush(
            subscription_info={
                "endpoint": sub_doc["endpoint"],
                "keys": sub_doc["keys"],
            },
            data=json.dumps(payload),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": f"mailto:{settings.vapid_claims_email}"},
        )
        return True
    except WebPushException as e:
        status = getattr(e.response, "status_code", None)
        if status in (404, 410):
            # Subscription expired or was revoked by the browser — clean it up.
            await push_subscriptions_collection.delete_one({"_id": sub_doc["_id"]})
        else:
            logger.warning("Push send failed (%s): %s", status, e)
        return False


async def notify_user_push(user_id: str, title: str, body: str, url: str = "/") -> None:
    if not is_configured():
        logger.info("[DEV PUSH — VAPID not configured] to=%s: %s — %s", user_id, title, body)
        return
    subs = await push_subscriptions_collection.find({"user_id": user_id}).to_list(length=20)
    payload = {"title": title, "body": body, "url": url}
    for sub in subs:
        await _send_to_subscription(sub, payload)


# Alias — reads more naturally at call sites that only ever target customers.
notify_customer_push = notify_user_push


async def notify_admins_push(title: str, body: str, url: str = "/admin") -> None:
    if not is_configured():
        logger.info("[DEV PUSH — VAPID not configured] to=admins: %s — %s", title, body)
        return
    admins = await users_collection.find({"role": "admin"}).to_list(length=50)
    admin_ids = [a["_id"] for a in admins]
    subs = await push_subscriptions_collection.find({"user_id": {"$in": admin_ids}}).to_list(length=200)
    payload = {"title": title, "body": body, "url": url}
    for sub in subs:
        await _send_to_subscription(sub, payload)


async def notify_delivery_partner_push(partner_id: str, title: str, body: str, url: str = "/delivery") -> None:
    await notify_user_push(partner_id, title, body, url)
