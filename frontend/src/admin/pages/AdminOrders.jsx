import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, ClipboardList, FileText } from "lucide-react";
import { adminApi, downloadBlob } from "../adminApi";
import { resolveImageUrl } from "../../api/client";

const STATUSES = ["placed", "confirmed", "packed", "out_for_delivery", "delivered", "cancelled"];
const LABEL = {
  placed: "Placed", confirmed: "Confirmed", packed: "Packed",
  out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled",
};
const PAYMENT_STATUSES = ["pending", "pending_verification", "paid"];
const PAYMENT_LABEL = { pending: "Pending", pending_verification: "Needs verification", paid: "Paid" };

export default function AdminOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") || "";
  const [orders, setOrders] = useState([]);
  const [partners, setPartners] = useState([]);
  const [filter, setFilter] = useState("");
  const [updating, setUpdating] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      setOrders(await adminApi.listOrders(filter || undefined, search || undefined));
    } catch (err) {
      setLoadError(err.response?.data?.detail || "Could not load orders. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search]);

  useEffect(() => {
    adminApi.listDeliveryPartners().then(setPartners).catch(() => {});
  }, []);

  useEffect(() => {
    const hasLiveDelivery = orders.some((o) => o.status === "out_for_delivery");
    if (!hasLiveDelivery) return;
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const updateStatus = async (id, status) => {
    setUpdating(id);
    try {
      await adminApi.updateOrderStatus(id, status);
      load();
    } finally {
      setUpdating(null);
    }
  };

  const updatePaymentStatus = async (id, payment_status) => {
    setUpdating(id);
    try {
      await adminApi.updatePaymentStatus(id, payment_status);
      load();
    } finally {
      setUpdating(null);
    }
  };

  const assignPartner = async (id, partnerId) => {
    if (!partnerId) return;
    setUpdating(id);
    try {
      await adminApi.assignOrder(id, partnerId);
      load();
    } finally {
      setUpdating(null);
    }
  };

  const exportCsv = async () => {
    const blob = await adminApi.exportCsv("orders");
    downloadBlob(blob, "orders.csv");
  };

  const downloadInvoice = async (order) => {
    const blob = await adminApi.downloadInvoice(order.id);
    downloadBlob(blob, `invoice-${order.order_number}.pdf`);
  };

  const clearSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("search");
    setSearchParams(next);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Orders</h1>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-sm">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
          </select>
          <button onClick={exportCsv} className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-black/5">
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {search && (
        <p className="mt-3 text-sm text-ink/60">
          Filtering by order number <span className="font-semibold">&ldquo;{search}&rdquo;</span>
          {" "}
          <button onClick={clearSearch} className="text-forest underline">clear</button>
        </p>
      )}

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-black/5" />)}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-black/5 bg-white p-8 text-center">
            <p className="text-sm font-medium text-red-500">{loadError}</p>
            <button onClick={load} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm">Retry</button>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-black/5 bg-white p-10 text-center text-ink/40">
            <ClipboardList size={28} />
            <p className="text-sm">No orders found{search ? " for this search" : ""}.</p>
          </div>
        ) : (
          orders.map((o) => (
            <div key={o.id} className={`rounded-xl border border-black/5 bg-white p-4 shadow-sm ${o.payment_status === "pending_verification" ? "ring-2 ring-turmeric" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">#{o.order_number}</p>
                  <p className="text-xs text-ink/50">{new Date(o.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-ink">₹{o.total}</p>
                  <p className="text-xs text-ink/50">
                    {o.payment_method}
                    {o.payment_status === "paid" ? (
                      <span className="ml-1 font-medium text-forest">· Paid{o.payment_collected_by ? ` by ${o.payment_collected_by}` : ""}</span>
                    ) : (
                      <span className="ml-1 font-medium text-red-500">· {o.payment_status === "pending_verification" ? "Needs verification" : "Unpaid"}</span>
                    )}
                  </p>
                  <button
                    onClick={() => downloadInvoice(o)}
                    className="mt-1 flex items-center gap-1 text-xs font-medium text-forest hover:underline"
                  >
                    <FileText size={12} /> Invoice
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {o.items.map((i) => (
                  <div key={i.product_id} className="flex items-center gap-1.5 rounded-lg bg-[#F5F6F8] px-2 py-1">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-white text-xs">
                      {i.image ? (
                        <img src={resolveImageUrl(i.image)} alt="" className="h-full w-full rounded object-contain" />
                      ) : (
                        "🥛"
                      )}
                    </div>
                    <span className="text-xs text-ink/70">{i.name} × {i.quantity}</span>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-sm text-ink/50">
                Deliver to: {o.address.line1}, {o.address.city} - {o.address.pincode}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-ink/60">Order status:</label>
                  <select
                    value={o.status}
                    disabled={updating === o.id}
                    onChange={(e) => updateStatus(o.id, e.target.value)}
                    className="rounded-lg border border-black/10 px-2 py-1 text-sm"
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
                  </select>
                </div>

                {(o.payment_method === "ONLINE" || o.payment_method === "COD") && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-ink/60">Payment:</label>
                    <select
                      value={o.payment_status}
                      disabled={updating === o.id}
                      onChange={(e) => updatePaymentStatus(o.id, e.target.value)}
                      className={`rounded-lg border px-2 py-1 text-sm ${o.payment_status === "pending_verification" ? "border-turmeric-dark font-semibold" : "border-black/10"}`}
                    >
                      {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{PAYMENT_LABEL[s]}</option>)}
                    </select>
                    {o.payment_status === "pending_verification" && (
                      <span className="text-xs font-medium text-turmeric-dark">⚠ check your UPI app / bank</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <label className="text-sm text-ink/60">Delivery:</label>
                  <select
                    value={o.delivery_partner_id || ""}
                    disabled={updating === o.id}
                    onChange={(e) => assignPartner(o.id, e.target.value)}
                    className="rounded-lg border border-black/10 px-2 py-1 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              {o.status === "out_for_delivery" && (
                <div className="mt-3 rounded-lg border border-black/5 bg-[#F5F6F8] p-3">
                  {o.delivery_location ? (
                    <>
                      <p className="mb-2 text-xs font-medium text-forest">
                        🛵 {o.delivery_partner_name} — live location, updated {new Date(o.delivery_location.updated_at).toLocaleTimeString()}
                      </p>
                      <iframe
                        title={`Live location for order ${o.order_number}`}
                        className="h-48 w-full rounded-lg border border-black/10"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${o.delivery_location.lng - 0.01}%2C${o.delivery_location.lat - 0.01}%2C${o.delivery_location.lng + 0.01}%2C${o.delivery_location.lat + 0.01}&marker=${o.delivery_location.lat}%2C${o.delivery_location.lng}&layer=mapnik`}
                      />
                    </>
                  ) : (
                    <p className="text-xs text-ink/50">
                      {o.delivery_partner_name ? `${o.delivery_partner_name} hasn't started sharing location yet.` : "No delivery partner location available."}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
