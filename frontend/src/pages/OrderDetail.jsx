import React, { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import client, { resolveImageUrl } from "../api/client";
import PaymentSection from "../components/PaymentSection";
import { downloadBlob } from "../utils/download";

const STEPS = ["placed", "confirmed", "packed", "out_for_delivery", "delivered"];
const STATUS_LABEL = {
  placed: "Placed",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const PAYMENT_STATUS_LABEL = {
  pending: "Pending",
  pending_verification: "Awaiting verification",
  paid: "Paid",
};

export default function OrderDetail() {
  const { orderId } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const load = () => client.get(`/orders/${orderId}`).then((res) => setOrder(res.data));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    if (order?.status !== "out_for_delivery") return;
    const interval = setInterval(load, 15000); // poll for live location while en route
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status]);

  if (!order) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-forest">Loading order...</div>;
  }

  const cancel = async () => {
    setCancelling(true);
    try {
      await client.post(`/orders/${orderId}/cancel`);
      await load();
    } finally {
      setCancelling(false);
    }
  };

  const downloadInvoice = async () => {
    const res = await client.get(`/orders/${orderId}/invoice`, { responseType: "blob" });
    downloadBlob(res.data, `invoice-${order.order_number}.pdf`);
  };

  const currentStepIndex = STEPS.indexOf(order.status);
  const canCancel = !["out_for_delivery", "delivered", "cancelled"].includes(order.status);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {location.state?.justPlaced && (
        <div className="mb-4 rounded-lg bg-forest/10 px-4 py-3 font-medium text-forest">
          🎉 Order placed successfully! We'll have it ready soon.
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Order #{order.order_number}</h1>
          <p className="text-sm text-ink/60">{new Date(order.created_at).toLocaleString()}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`badge ${order.status === "cancelled" ? "bg-red-100 text-red-600" : "bg-forest/10 text-forest"}`}>
            {STATUS_LABEL[order.status]}
          </span>
          <button onClick={downloadInvoice} className="text-xs font-semibold text-forest underline">
            Download invoice
          </button>
        </div>
      </div>

      {order.status !== "cancelled" && (
        <div className="mt-6 flex items-center justify-between">
          {STEPS.map((step, idx) => (
            <div key={step} className="flex flex-1 flex-col items-center text-center">
              <div
                className={`h-3 w-3 rounded-full ${idx <= currentStepIndex ? "bg-forest" : "bg-forest/20"}`}
              />
              <p className={`mt-1 text-[11px] ${idx <= currentStepIndex ? "text-forest font-medium" : "text-ink/40"}`}>
                {STATUS_LABEL[step]}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 divide-y divide-forest/10 rounded-xl2 bg-white shadow-sm">
        {order.items.map((item) => (
          <div key={item.product_id} className="flex items-center gap-3 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-cream text-xl">
              {item.image ? (
                <img src={resolveImageUrl(item.image)} alt={item.name} className="h-full w-full rounded-lg object-contain p-0.5" />
              ) : (
                "🥛"
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-ink">{item.name}</p>
              <p className="text-sm text-ink/60">{item.quantity} × ₹{item.price} · {item.unit}</p>
            </div>
            <p className="font-semibold text-ink">₹{item.line_total}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1 rounded-xl2 bg-white p-4 shadow-sm">
        <Row label="Subtotal" value={`₹${order.subtotal}`} />
        <Row label="Delivery fee" value={order.delivery_fee === 0 ? "FREE" : `₹${order.delivery_fee}`} />
        <div className="my-2 border-t border-forest/10" />
        <Row label="Total" value={`₹${order.total}`} bold />
      </div>

      <div className="mt-4 rounded-xl2 bg-white p-4 shadow-sm">
        <h3 className="font-display font-semibold text-ink">Delivery address</h3>
        <p className="mt-1 text-sm text-ink/70">
          {order.address.label} — {order.address.line1}
          {order.address.line2 ? `, ${order.address.line2}` : ""}, {order.address.city} - {order.address.pincode}
        </p>
        <p className="mt-2 text-sm text-ink/70">
          Payment: {order.payment_method} · {PAYMENT_STATUS_LABEL[order.payment_status] || order.payment_status}
        </p>
        {order.payment_status === "paid" && order.payment_collected_by && (
          <p className="mt-1 text-xs text-ink/50">
            Collected by {order.payment_collected_by}
            {order.payment_collected_at && ` on ${new Date(order.payment_collected_at).toLocaleString()}`}
          </p>
        )}
      </div>

      {order.payment_method === "COD" && order.payment_status !== "paid" && !["delivered", "cancelled"].includes(order.status) && (
        <div className="mt-4 rounded-xl2 bg-turmeric/10 p-4 text-sm text-ink">
          💵 Please keep ₹{order.total} ready for cash on delivery, or your delivery partner can collect it via UPI at the door.
        </div>
      )}

      {order.delivery_partner_name && !["delivered", "cancelled"].includes(order.status) && (
        <div className="mt-4 rounded-xl2 bg-white p-4 shadow-sm">
          <h3 className="font-display font-semibold text-ink">Your delivery partner</h3>
          <p className="mt-1 text-sm text-ink/70">
            {order.delivery_partner_name} · <a href={`tel:${order.delivery_partner_phone}`} className="text-forest underline">{order.delivery_partner_phone}</a>
          </p>

          {order.status === "out_for_delivery" && order.delivery_location && (
            <div className="mt-3">
              <p className="mb-2 text-sm font-medium text-forest">🛵 On the way — live location</p>
              <iframe
                title="Delivery partner location"
                className="h-56 w-full rounded-lg border border-forest/20"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${order.delivery_location.lng - 0.01}%2C${order.delivery_location.lat - 0.01}%2C${order.delivery_location.lng + 0.01}%2C${order.delivery_location.lat + 0.01}&marker=${order.delivery_location.lat}%2C${order.delivery_location.lng}&layer=mapnik`}
              />
              <p className="mt-1 text-xs text-ink/40">
                Updated {new Date(order.delivery_location.updated_at).toLocaleTimeString()}
              </p>
            </div>
          )}
          {order.status === "out_for_delivery" && !order.delivery_location && (
            <p className="mt-2 text-xs text-ink/50">Your delivery partner hasn't started sharing their location yet.</p>
          )}
        </div>
      )}

      <PaymentSection order={order} onPaid={load} />

      {canCancel && (
        <button
          onClick={cancel}
          disabled={cancelling}
          className="mt-6 w-full rounded-full border border-red-400 px-6 py-3 font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50"
        >
          {cancelling ? "Cancelling..." : "Cancel order"}
        </button>
      )}

      <Link to="/orders" className="mt-4 block text-center text-sm font-semibold text-forest underline">
        Back to all orders
      </Link>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold text-ink" : "text-ink/70"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
