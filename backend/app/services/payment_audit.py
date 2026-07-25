"""
Shared helper for changing an order's payment_status with a full audit
trail (who changed it, from what, to what, when). Used by every code path
that can change payment status — customer self-report, admin verification,
and delivery-partner COD collection — so there's exactly one place this
logic lives, per the "avoid duplicate payment logic" requirement.
"""
from datetime import datetime, timezone
from typing import Optional

from app.database import orders_collection


async def change_payment_status(
    order: dict,
    new_status: str,
    changed_by_name: str,
    changed_by_role: str,
    collected_by_name: Optional[str] = None,
) -> dict:
    now = datetime.now(timezone.utc)
    history_entry = {
        "from_status": order.get("payment_status", "pending"),
        "to_status": new_status,
        "changed_by_name": changed_by_name,
        "changed_by_role": changed_by_role,
        "at": now,
    }

    update = {"$set": {"payment_status": new_status}, "$push": {"payment_history": history_entry}}
    if new_status == "paid":
        update["$set"]["payment_collected_by"] = collected_by_name or changed_by_name
        update["$set"]["payment_collected_at"] = now

    await orders_collection.update_one({"_id": order["_id"]}, update)
    updated = await orders_collection.find_one({"_id": order["_id"]})
    return updated
