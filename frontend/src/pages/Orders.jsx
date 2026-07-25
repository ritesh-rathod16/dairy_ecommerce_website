import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client, { resolveImageUrl } from "../api/client";

const STATUS_LABEL = {
  placed: "Placed",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function Orders() {
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    client.get("/orders").then((res) => setOrders(res.data));
  }, []);

  if (orders === null) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-forest">Loading orders...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h2 className="font-display text-xl font-semibold text-ink">No orders yet</h2>
        <p className="mt-1 text-ink/60">Your order history will show up here.</p>
        <Link to="/" className="mt-6 inline-block rounded-full bg-forest px-6 py-3 font-semibold text-cream hover:bg-forest-light">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Your Orders</h1>
      <div className="mt-4 space-y-3">
        {orders.map((o) => (
          <Link
            key={o.id}
            to={`/orders/${o.id}`}
            className="flex items-center gap-3 rounded-xl2 bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-cream text-xl">
              {o.items[0]?.image ? (
                <img src={resolveImageUrl(o.items[0].image)} alt="" className="h-full w-full rounded-lg object-contain p-0.5" />
              ) : (
                "🥛"
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-ink">#{o.order_number}</p>
              <p className="text-sm text-ink/60">{o.items.length} item{o.items.length > 1 ? "s" : ""} · ₹{o.total}</p>
              <p className="text-xs text-ink/40">{new Date(o.created_at).toLocaleString()}</p>
            </div>
            <span className={`badge ${o.status === "cancelled" ? "bg-red-100 text-red-600" : "bg-forest/10 text-forest"}`}>
              {STATUS_LABEL[o.status] || o.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
