from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from app.models.user import AddressIn


class OrderItemOut(BaseModel):
    product_id: str
    name: str
    unit: str
    price: float
    quantity: int
    line_total: float
    image: Optional[str] = None


class OrderCreate(BaseModel):
    address: AddressIn
    payment_method: str = "COD"   # COD only for v1; UPI to be added later
    notes: Optional[str] = None


ORDER_STATUSES = [
    "placed",
    "confirmed",
    "packed",
    "out_for_delivery",
    "delivered",
    "cancelled",
]


class OrderStatusEvent(BaseModel):
    status: str
    at: datetime


class DeliveryLocation(BaseModel):
    lat: float
    lng: float
    updated_at: datetime


class CustomerInfo(BaseModel):
    name: str
    phone: str


DELIVERY_STAGES = [
    "assigned",
    "accepted",
    "heading_to_store",
    "reached_store",
    "packed",
    "picked_up",
    "heading_to_customer",
    "reached_customer",
    "delivered",
]


class DeliveryStageEvent(BaseModel):
    stage: str
    at: datetime


class PaymentHistoryEntry(BaseModel):
    from_status: str
    to_status: str
    changed_by_name: str
    changed_by_role: str
    at: datetime


class OrderOut(BaseModel):
    id: str
    order_number: str
    user_id: str
    items: list[OrderItemOut]
    subtotal: float
    delivery_fee: float
    total: float
    address: AddressIn
    payment_method: str
    payment_status: str = "pending"
    status: str
    timeline: list[OrderStatusEvent]
    notes: Optional[str] = None
    created_at: datetime
    delivery_partner_id: Optional[str] = None
    delivery_partner_name: Optional[str] = None
    delivery_partner_phone: Optional[str] = None
    delivery_location: Optional[DeliveryLocation] = None
    customer: Optional[CustomerInfo] = None
    payment_collected_by: Optional[str] = None
    payment_collected_at: Optional[datetime] = None
    payment_collection_method: Optional[str] = None  # "cash" | "upi"
    payment_history: list[PaymentHistoryEntry] = []
    delivery_stage: Optional[str] = None
    delivery_stage_timeline: list[DeliveryStageEvent] = []
    reject_reason: Optional[str] = None
