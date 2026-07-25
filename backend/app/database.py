from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

client = AsyncIOMotorClient(settings.mongo_uri)
db = client[settings.mongo_db_name]

users_collection = db["users"]
categories_collection = db["categories"]
products_collection = db["products"]
carts_collection = db["carts"]
orders_collection = db["orders"]
settings_collection = db["settings"]
push_subscriptions_collection = db["push_subscriptions"]


async def init_indexes():
    """Create indexes required for correctness/performance. Called once on startup."""
    await users_collection.create_index("email", unique=True)
    await users_collection.create_index("phone", unique=True)
    await products_collection.create_index("slug", unique=True)
    await products_collection.create_index("category_id")
    await categories_collection.create_index("slug", unique=True)
    await carts_collection.create_index("user_id", unique=True)
    await orders_collection.create_index("user_id")
    await orders_collection.create_index("order_number", unique=True)
    await orders_collection.create_index("delivery_partner_id")
    await push_subscriptions_collection.create_index("endpoint", unique=True)
    await push_subscriptions_collection.create_index("user_id")
