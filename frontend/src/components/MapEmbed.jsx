import React, { useEffect, useRef, useState } from "react";
import { isGoogleMapsConfigured, loadGoogleMaps } from "../utils/googleMapsLoader";

/**
 * Props: storeLat/storeLng (required), customerLat/customerLng (optional),
 * riderLat/riderLng (optional, live), height (px, default 220).
 *
 * If VITE_GOOGLE_MAPS_API_KEY is set: renders a real interactive Google Map
 * with store/customer/rider markers and a driving route between store and
 * customer, via the Directions API.
 *
 * If not set: falls back to the free OpenStreetMap iframe embed (no key
 * needed) already used elsewhere in this app, centered on whichever points
 * are available. Upgrades to the full experience automatically the moment
 * a key is added — no code changes needed on your end.
 */
export default function MapEmbed({ storeLat, storeLng, customerLat, customerLng, riderLat, riderLng, height = 220 }) {
  const [useGoogle] = useState(isGoogleMapsConfigured());

  if (useGoogle) {
    return (
      <GoogleMapView
        storeLat={storeLat} storeLng={storeLng}
        customerLat={customerLat} customerLng={customerLng}
        riderLat={riderLat} riderLng={riderLng}
        height={height}
      />
    );
  }
  return (
    <OsmFallbackMap
      storeLat={storeLat} storeLng={storeLng}
      customerLat={customerLat} customerLng={customerLng}
      riderLat={riderLat} riderLng={riderLng}
      height={height}
    />
  );
}

function GoogleMapView({ storeLat, storeLng, customerLat, customerLng, riderLat, riderLng, height }) {
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef([]);
  const directionsRendererRef = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapRef.current) return;
        mapObjRef.current = new maps.Map(mapRef.current, {
          center: { lat: storeLat, lng: storeLng },
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
        });
        directionsRendererRef.current = new maps.DirectionsRenderer({ suppressMarkers: true });
        directionsRendererRef.current.setMap(mapObjRef.current);
        setReady(true);
      })
      .catch(() => setError("Could not load Google Maps."));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !window.google?.maps || !mapObjRef.current) return;
    const maps = window.google.maps;
    const map = mapObjRef.current;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new maps.LatLngBounds();

    markersRef.current.push(new maps.Marker({
      position: { lat: storeLat, lng: storeLng }, map,
      label: { text: "S", color: "white" },
      icon: { path: maps.SymbolPath.CIRCLE, fillColor: "#1B4332", fillOpacity: 1, strokeWeight: 0, scale: 10 },
      title: "Store",
    }));
    bounds.extend({ lat: storeLat, lng: storeLng });

    if (customerLat != null && customerLng != null) {
      markersRef.current.push(new maps.Marker({
        position: { lat: customerLat, lng: customerLng }, map,
        label: { text: "C", color: "white" },
        icon: { path: maps.SymbolPath.CIRCLE, fillColor: "#DC2626", fillOpacity: 1, strokeWeight: 0, scale: 10 },
        title: "Customer",
      }));
      bounds.extend({ lat: customerLat, lng: customerLng });

      const directionsService = new maps.DirectionsService();
      directionsService.route(
        {
          origin: { lat: storeLat, lng: storeLng },
          destination: { lat: customerLat, lng: customerLng },
          travelMode: maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === "OK") directionsRendererRef.current.setDirections(result);
        }
      );
    }

    if (riderLat != null && riderLng != null) {
      markersRef.current.push(new maps.Marker({
        position: { lat: riderLat, lng: riderLng }, map,
        icon: { path: maps.SymbolPath.CIRCLE, fillColor: "#E8A33D", fillOpacity: 1, strokeWeight: 2, strokeColor: "#fff", scale: 8 },
        title: "Delivery partner (live)",
      }));
      bounds.extend({ lat: riderLat, lng: riderLng });
    }

    map.fitBounds(bounds, 40);
  }, [ready, storeLat, storeLng, customerLat, customerLng, riderLat, riderLng]);

  if (error) {
    return <div className="flex items-center justify-center rounded-lg bg-cream/60 text-xs text-ink/40" style={{ height }}>{error}</div>;
  }
  return <div ref={mapRef} className="w-full rounded-lg border border-black/10" style={{ height }} />;
}

function OsmFallbackMap({ storeLat, storeLng, customerLat, customerLng, riderLat, riderLng, height }) {
  const lat = riderLat ?? customerLat ?? storeLat;
  const lng = riderLng ?? customerLng ?? storeLng;
  const markerLat = riderLat ?? customerLat ?? storeLat;
  const markerLng = riderLng ?? customerLng ?? storeLng;
  const pad = 0.015;

  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - pad}%2C${lat - pad}%2C${lng + pad}%2C${lat + pad}&marker=${markerLat}%2C${markerLng}&layer=mapnik`;

  return (
    <div>
      <iframe title="Delivery map" className="w-full rounded-lg border border-black/10" style={{ height }} src={src} />
      <p className="mt-1 text-[10px] text-ink/30">
        Free map preview — add VITE_GOOGLE_MAPS_API_KEY for live route/rider tracking on one map.
      </p>
    </div>
  );
}
