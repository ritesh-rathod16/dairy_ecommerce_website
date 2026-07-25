from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    phone: str = Field(min_length=10, max_length=15)
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class AddressIn(BaseModel):
    label: str = "Home"
    line1: str
    line2: Optional[str] = None
    city: str
    pincode: str
    lat: Optional[float] = None
    lng: Optional[float] = None


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    phone: str
    role: str = "customer"
    addresses: list[AddressIn] = []


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
