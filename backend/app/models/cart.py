from pydantic import BaseModel, Field


class CartItemIn(BaseModel):
    product_id: str
    quantity: int = Field(ge=1, le=50)


class CartItemOut(BaseModel):
    product_id: str
    name: str
    image: str | None = None
    unit: str
    price: float
    quantity: int
    line_total: float
    stock: int
    is_available: bool


class CartOut(BaseModel):
    items: list[CartItemOut]
    subtotal: float
    delivery_fee: float
    total: float
    free_delivery_limit: float
