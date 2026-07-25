"""
Google Maps integration (Geocoding + Distance Matrix APIs) via direct REST
calls. If GOOGLE_MAPS_SERVER_API_KEY is unset, these functions return None
and callers should fall back gracefully (e.g. skip the delivery-radius
check rather than blocking checkout).

Requires the Geocoding API and Distance Matrix API enabled on the key.
"""
from typing import Optional

import httpx

from app.config import settings

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"


def is_configured() -> bool:
    return bool(settings.google_maps_server_api_key)


async def geocode_address(address: str) -> Optional[dict]:
    """Returns {"lat": float, "lng": float, "formatted_address": str} or None."""
    if not is_configured():
        return None
    params = {"address": address, "key": settings.google_maps_server_api_key}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(GEOCODE_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    if data.get("status") != "OK" or not data.get("results"):
        return None
    result = data["results"][0]
    loc = result["geometry"]["location"]
    return {"lat": loc["lat"], "lng": loc["lng"], "formatted_address": result["formatted_address"]}


async def distance_from_store_km(dest_lat: float, dest_lng: float) -> Optional[float]:
    """Driving distance in km from the store to the given point, or None if unavailable."""
    info = await route_info_from_store(dest_lat, dest_lng)
    return info["distance_km"] if info else None


async def route_info_from_store(dest_lat: float, dest_lng: float) -> Optional[dict]:
    """Returns {"distance_km": float, "duration_minutes": float} from the store to the given point, or None."""
    if not is_configured():
        return None
    origin = f"{settings.store_lat},{settings.store_lng}"
    destination = f"{dest_lat},{dest_lng}"
    params = {"origins": origin, "destinations": destination, "key": settings.google_maps_server_api_key}

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(DISTANCE_MATRIX_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    try:
        element = data["rows"][0]["elements"][0]
        if element["status"] != "OK":
            return None
        return {
            "distance_km": round(element["distance"]["value"] / 1000, 2),
            "duration_minutes": round(element["duration"]["value"] / 60, 1),
        }
    except (KeyError, IndexError):
        return None


async def is_within_delivery_radius(dest_lat: float, dest_lng: float) -> Optional[bool]:
    """Returns True/False, or None if the distance couldn't be determined (key missing/API error)."""
    distance = await distance_from_store_km(dest_lat, dest_lng)
    if distance is None:
        return None
    return distance <= settings.delivery_radius_km
