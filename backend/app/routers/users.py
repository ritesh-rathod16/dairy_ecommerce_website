from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.database import users_collection
from app.models.user import AddressIn, UserOut
from app.security import get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def me(user=Depends(get_current_user)):
    return UserOut(
        id=user["_id"], name=user["name"], email=user["email"],
        phone=user["phone"], role=user.get("role", "customer"), addresses=user.get("addresses", []),
    )


@router.post("/me/addresses", response_model=UserOut)
async def add_address(payload: AddressIn, user=Depends(get_current_user)):
    addresses = user.get("addresses", [])
    addresses.append(payload.model_dump())
    await users_collection.update_one({"_id": user["_id"]}, {"$set": {"addresses": addresses}})
    return UserOut(
        id=user["_id"], name=user["name"], email=user["email"], phone=user["phone"],
        role=user.get("role", "customer"), addresses=addresses,
    )


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


@router.post("/me/change-password")
async def change_password(payload: ChangePasswordIn, user=Depends(get_current_user)):
    """Works for any authenticated account — customer, admin, or delivery partner."""
    if not verify_password(payload.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from the current one")

    await users_collection.update_one(
        {"_id": user["_id"]}, {"$set": {"password_hash": hash_password(payload.new_password)}}
    )
    return {"ok": True}
