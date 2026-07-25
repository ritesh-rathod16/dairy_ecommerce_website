from typing import Optional
from pydantic import BaseModel, Field


class ProductOut(BaseModel):
    id: str
    name: str
    slug: str
    description: str
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    price: float
    mrp: float
    unit: str            # e.g. "500 ml", "1 kg", "6 pcs"
    image: Optional[str] = None
    stock: int
    is_available: bool = True
    gst_percent: float = 0
    tags: list[str] = []


class ProductListResponse(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    page_size: int
