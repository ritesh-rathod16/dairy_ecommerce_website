from pydantic import Field, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db_name: str = Field(
        default="katlkar_dairy",
        validation_alias=AliasChoices("MONGO_DB_NAME", "DATABASE_NAME"),
    )

    jwt_secret: str = "dev_secret_change_me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    store_lat: float = 21.1458
    store_lng: float = 79.0882
    store_phone: str = ""
    store_address: str = ""
    free_delivery_limit: float = 299
    delivery_radius_km: float = 8
    store_open_time: str = "07:00"
    store_close_time: str = "21:00"

    # Email (optional — if unset, notifications are just logged to the console)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_email: str = ""
    smtp_password: str = ""

    # Payment: merchant UPI (no gateway account needed — generates a real
    # "Scan to pay" QR for your UPI ID; payment is confirmed manually)
    upi_id: str = "katlkardairy@upi"
    merchant_name: str = "Katlkar Dairy"

    # Maps (server-side key for geocoding/distance; optional)
    google_maps_server_api_key: str = ""

    # Web Push (optional — if unset, push notifications are silently skipped
    # rather than raising errors; generate with backend/generate_vapid_keys.py)
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_claims_email: str = "admin@example.com"


settings = Settings()
