import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { deliveryApi } from "./deliveryApi";

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: "Today", from: () => isoDaysAgo(0) },
  { label: "This week", from: () => isoDaysAgo(7) },
  { label: "This month", from: () => isoDaysAgo(30) },
];

export default function DeliveryHistory() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setOrders(await deliveryApi.getHistory(dateFrom || undefined, dateTo || undefined, status || undefined));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, status]);

  const totalCollected = orders.filter((o) => o.status === "delivered").reduce((s, o) => s + o.total, 0);

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center gap-3 bg-forest px-4 py-3 text-cream">
        <Link to="/delivery" className="flex items-center gap-1 text-sm"><ArrowLeft size={16} /> Back</Link>
        <span className="font-display font-semibold">Delivery History</span>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => setDateFrom(p.from())} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm">
              {p.label}
            </button>
          ))}
          <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm">
            All time
          </button>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-black/10 px-2 py-1.5 text-sm" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-black/10 px-2 py-1.5 text-sm" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-black/10 px-2 py-1.5 text-sm">
            <option value="">Delivered + Cancelled</option>
            <option value="delivered">Delivered only</option>
            <option value="cancelled">Cancelled only</option>
          </select>
        </div>

        <p className="mt-3 text-sm text-ink/60">Total collected in this range: <span className="font-semibold text-ink">₹{totalCollected}</span></p>

        <div className="mt-3 rounded-xl2 bg-white shadow-sm">
          {loading ? (
            <div className="space-y-2 p-4">{[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-black/5" />)}</div>
          ) : orders.length === 0 ? (
            <p className="p-6 text-center text-sm text-ink/40">No deliveries in this range.</p>
          ) : (
            <div className="divide-y divide-black/5">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="font-medium text-ink">#{o.order_number}</p>
                    <p className="text-xs text-ink/40">{new Date(o.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-ink">₹{o.total}</p>
                    <span className={`badge ${o.status === "delivered" ? "bg-forest/10 text-forest" : "bg-red-100 text-red-600"}`}>
                      {o.status === "delivered" ? "Delivered" : "Cancelled"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
