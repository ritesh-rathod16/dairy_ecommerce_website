import React, { useEffect, useState } from "react";
import { MapPin, Phone } from "lucide-react";
import { adminApi } from "../adminApi";
import MapEmbed from "../../components/MapEmbed";

export default function AdminLiveTracking() {
  const [orders, setOrders] = useState([]);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [allOrders, settingsData] = await Promise.all([
        adminApi.listOrders("out_for_delivery"),
        adminApi.getSettings(),
      ]);
      setOrders(allOrders);
      setStore({ lat: settingsData.store_lat, lng: settingsData.store_lng });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Live Tracking</h1>
      <p className="mt-1 text-sm text-ink/50">All orders currently out for delivery.</p>

      {loading ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, i) => <div key={i} className="h-72 animate-pulse rounded-xl bg-black/5" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-black/5 bg-white p-10 text-center text-ink/40">
          <MapPin size={28} />
          <p className="text-sm">No active deliveries right now.</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-ink">#{o.order_number}</p>
                  <p className="text-sm text-ink/60">Rider: {o.delivery_partner_name || "Unassigned"}</p>
                </div>
                {o.delivery_partner_phone && (
                  <a href={`tel:${o.delivery_partner_phone}`} className="flex items-center gap-1 text-sm font-medium text-forest">
                    <Phone size={13} /> Call rider
                  </a>
                )}
              </div>

              {store && (
                <div className="mt-3">
                  <MapEmbed
                    storeLat={store.lat} storeLng={store.lng}
                    customerLat={o.address?.lat} customerLng={o.address?.lng}
                    riderLat={o.delivery_location?.lat} riderLng={o.delivery_location?.lng}
                    height={240}
                  />
                </div>
              )}

              <div className="mt-2 flex items-center justify-between text-xs text-ink/50">
                <span>Delivering to: {o.address.city} - {o.address.pincode}</span>
                {o.delivery_location?.updated_at && (
                  <span>Last update: {new Date(o.delivery_location.updated_at).toLocaleTimeString()}</span>
                )}
              </div>
              {!o.delivery_location && (
                <p className="mt-1 text-xs text-turmeric-dark">Rider hasn't started sharing location yet.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
