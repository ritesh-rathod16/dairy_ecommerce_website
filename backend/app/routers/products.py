from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from app.database import products_collection, categories_collection
from app.models.product import ProductOut, ProductListResponse

router = APIRouter(prefix="/api/products", tags=["products"])


async def _category_name(category_id: str) -> Optional[str]:
    cat = await categories_collection.find_one({"_id": category_id})
    return cat["name"] if cat else None


def _to_out(d: dict, category_name: Optional[str] = None) -> ProductOut:
    return ProductOut(
        id=d["_id"], name=d["name"], slug=d["slug"], description=d.get("description", ""),
        category_id=d["category_id"], category_name=category_name,
        price=d["price"], mrp=d.get("mrp", d["price"]), unit=d["unit"],
        image=d.get("image"), stock=d.get("stock", 0),
        is_available=d.get("is_available", True), gst_percent=d.get("gst_percent", 0),
        tags=d.get("tags", []),
    )


@router.get("", response_model=ProductListResponse)
async def list_products(
    category: Optional[str] = Query(None, description="category slug"),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query: dict = {}
    if category:
        cat = await categories_collection.find_one({"slug": category})
        if not cat:
            return ProductListResponse(items=[], total=0, page=page, page_size=page_size)
        query["category_id"] = cat["_id"]
    if search:
        query["name"] = {"$regex": search, "$options": "i"}

    total = await products_collection.count_documents(query)
    cursor = (
        products_collection.find(query)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    docs = await cursor.to_list(length=page_size)

    # Resolve category names in bulk
    cat_ids = list({d["category_id"] for d in docs})
    cats = await categories_collection.find({"_id": {"$in": cat_ids}}).to_list(length=len(cat_ids) or 1)
    cat_map = {c["_id"]: c["name"] for c in cats}

    items = [_to_out(d, cat_map.get(d["category_id"])) for d in docs]
    return ProductListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{slug}", response_model=ProductOut)
async def get_product(slug: str):
    d = await products_collection.find_one({"slug": slug})
    if not d:
        raise HTTPException(status_code=404, detail="Product not found")
    name = await _category_name(d["category_id"])
    return _to_out(d, name)
