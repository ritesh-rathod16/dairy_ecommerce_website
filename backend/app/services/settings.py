"""
Admin-editable runtime settings, stored in a single Mongo document
(settings_collection, _id="global"). Falls back to the .env-based
`config.settings` defaults if nothing's been saved yet — so the app works
immediately after a fresh seed, and admins can override from the UI later
without redeploying.
"""
from app.database import settings_collection
from app.config import settings as env_settings

SETTINGS_DOC_ID = "global"

DEFAULTS = {
    "upi_id": env_settings.upi_id,
    "merchant_name": env_settings.merchant_name,
}


async def get_runtime_settings() -> dict:
    doc = await settings_collection.find_one({"_id": SETTINGS_DOC_ID})
    if not doc:
        return dict(DEFAULTS)
    return {**DEFAULTS, **{k: v for k, v in doc.items() if k != "_id"}}


async def update_runtime_settings(updates: dict) -> dict:
    await settings_collection.update_one(
        {"_id": SETTINGS_DOC_ID}, {"$set": updates}, upsert=True
    )
    return await get_runtime_settings()
