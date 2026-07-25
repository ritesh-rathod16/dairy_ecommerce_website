from typing import Optional
from pydantic import BaseModel


class CategoryOut(BaseModel):
    id: str
    name: str
    slug: str
    icon: Optional[str] = None
    sort_order: int = 0
