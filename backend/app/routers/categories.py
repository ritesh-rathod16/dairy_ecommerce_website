from fastapi import APIRouter
from app.database import categories_collection
from app.models.category import CategoryOut

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
async def list_categories():
    cursor = categories_collection.find().sort("sort_order", 1)
    docs = await cursor.to_list(length=200)
    return [
        CategoryOut(
            id=d["_id"], name=d["name"], slug=d["slug"],
            icon=d.get("icon"), sort_order=d.get("sort_order", 0),
        )
        for d in docs
    ]
