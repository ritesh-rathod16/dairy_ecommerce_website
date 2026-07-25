import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  IndianRupee, ShoppingBag, Clock, Package, AlertTriangle, Users, TrendingUp,
} from "lucide-react";
import { adminApi } from "../adminApi";

const STATUS_LABEL = {
  placed: "Placed", confirmed: "Confirmed", packed: "Packed",
  out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi.dashboard()
      .then(setStats)
      .catch((err) => setError(err.response?.data?.detail || "Could not load dashboard data."));
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-black/5 bg-white p-10 text-center">
        <p className="text-sm font-medium text-red-500">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[...Array(8)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-black/5" />)}
      </div>
    );
  }

  const cards = [
    { label: "Today's sales", value: `₹${stats.today_sales}`, sub: `${stats.today_order_count} orders today`, icon: IndianRupee, tone: "text-forest" },
    { label: "Total revenue", value: `₹${stats.total_revenue}`, icon: TrendingUp, tone: "text-forest" },
    { label: "Total orders", value: stats.total_orders, sub: `${stats.orders_last_7_days} in last 7 days`, icon: ShoppingBag, tone: "text-ink" },
    { label: "Pending orders", value: stats.pending_orders, icon: Clock, tone: "text-turmeric-dark" },
    { label: "Total products", value: stats.total_products, icon: Package, tone: "text-ink" },
    { label: "Low stock (≤5)", value: stats.low_stock_products, icon: AlertTriangle, tone: stats.low_stock_products > 0 ? "text-red-500" : "text-ink" },
    { label: "Customers", value: stats.total_customers, icon: Users, tone: "text-ink" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
      <p className="mt-1 text-sm text-ink/50">Live overview of your store</p>

      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-ink/40">{c.label}</p>
                <Icon size={16} className={c.tone} />
              </div>
              <p className={`mt-2 text-2xl font-semibold ${c.tone}`}>{c.value}</p>
              {c.sub && <p className="mt-0.5 text-xs text-ink/40">{c.sub}</p>}
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-ink">Recent orders</h2>
            <Link to="/admin/orders" className="text-sm font-medium text-forest hover:underline">View all</Link>
          </div>
          {stats.recent_orders.length === 0 ? (
            <p className="mt-3 text-sm text-ink/40">No orders yet.</p>
          ) : (
            <div className="mt-3 divide-y divide-black/5">
              {stats.recent_orders.map((o) => (
                <Link key={o.id} to={`/admin/orders?search=${o.order_number}`} className="flex items-center justify-between py-2.5 text-sm hover:bg-black/[0.02]">
                  <div>
                    <p className="font-medium text-ink">#{o.order_number}</p>
                    <p className="text-xs text-ink/40">{new Date(o.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-ink">₹{o.total}</p>
                    <p className="text-xs text-ink/40">{STATUS_LABEL[o.status] || o.status}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Top-selling products</h2>
          {stats.top_products.length === 0 ? (
            <p className="mt-3 text-sm text-ink/40">No sales yet.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {stats.top_products.map((p, idx) => {
                const max = stats.top_products[0].quantity_sold || 1;
                const pct = Math.round((p.quantity_sold / max) * 100);
                return (
                  <li key={p.name}>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink">{idx + 1}. {p.name}</span>
                      <span className="font-medium text-ink/60">{p.quantity_sold} sold</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-black/5">
                      <div className="h-1.5 rounded-full bg-forest" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
