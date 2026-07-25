import uuid
from fastapi import APIRouter, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Depends

from app.database import users_collection, carts_collection
from app.models.user import UserRegister, UserLogin, UserOut, TokenOut
from app.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _to_user_out(doc: dict) -> UserOut:
    return UserOut(
        id=doc["_id"],
        name=doc["name"],
        email=doc["email"],
        phone=doc["phone"],
        role=doc.get("role", "customer"),
        addresses=doc.get("addresses", []),
    )


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister):
    existing = await users_collection.find_one(
        {"$or": [{"email": payload.email}, {"phone": payload.phone}]}
    )
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email or phone already exists")

    user_id = str(uuid.uuid4())
    user_doc = {
        "_id": user_id,
        "name": payload.name,
        "email": payload.email,
        "phone": payload.phone,
        "password_hash": hash_password(payload.password),
        "addresses": [],
        "role": "customer",
    }
    await users_collection.insert_one(user_doc)
    await carts_collection.insert_one({"user_id": user_id, "items": []})

    token = create_access_token({"sub": user_id})
    return TokenOut(access_token=token, user=_to_user_out(user_doc))


@router.post("/login", response_model=TokenOut)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    # form.username carries the email (OAuth2 password flow convention)
    user = await users_collection.find_one({"email": form.username})
    if not user or not verify_password(form.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if user.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="This account has been suspended. Contact an administrator.")

    token = create_access_token({"sub": user["_id"]})
    return TokenOut(access_token=token, user=_to_user_out(user))


@router.post("/login-json", response_model=TokenOut)
async def login_json(payload: UserLogin):
    """Same as /login but accepts plain JSON instead of form-encoded data (easier from the React app)."""
    user = await users_collection.find_one({"email": payload.email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if user.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="This account has been suspended. Contact an administrator.")

    token = create_access_token({"sub": user["_id"]})
    return TokenOut(access_token=token, user=_to_user_out(user))
