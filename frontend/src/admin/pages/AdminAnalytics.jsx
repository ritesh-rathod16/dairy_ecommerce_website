import React, { useEffect, useState } from "react";
import {
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Download, FileSpreadsheet, Printer, AlertTriangle } from "lucide-react";
import { adminApi, downloadBlob } from "../adminApi";
import { resolveImageUrl } from "../../api/client";

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: "Today", from: () => isoDaysAgo(0), to: () => isoDaysAgo(0) },
  { label: "Yesterday", from: () => isoDaysAgo(1), to: () => isoDaysAgo(1) },
  { label: "Last 7 days", from: () => isoDaysAgo(7), to: () => isoDaysAgo(0) },
  { label: "Last 30 days", from: () => isoDaysAgo(30), to: () => isoDaysAgo(0) },
  { label: "Last 90 days", from: () => isoDaysAgo(90), to: () => isoDaysAgo(0) },
  { label: "This year", from: () => isoDaysAgo(365), to: () => isoDaysAgo(0) },
];

const DONUT_COLORS = ["#1B4332", "#2D6A4F", "#E8A33D", "#C9821F", "#94A3B8", "#B45309"];
const STATUS_LABEL = { placed: "Placed", confirmed: "Confirmed", packed: "Packed", out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled" };
const STATUS_COLOR = { placed: "bg-turmeric/20 text-turmeric-dark", confirmed: "bg-blue-100 text-blue-700", packed: "bg-forest/10 text-forest", out_for_delivery: "bg-forest/20 text-forest", delivered: "bg-forest text-cream", cancelled: "bg-red-100 text-red-600" };

export default function AdminAnalytics() {
  const [dateFrom, setDateFrom] = useState(isoDaysAgo(30));
  const [dateTo, setDateTo] = useState(isoDaysAgo(0));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const filters = { payment_method: paymentMethod || undefined, order_status: orderStatus || undefined, category: category || undefined };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminApi.getAnalytics(dateFrom, dateTo, filters));
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, paymentMethod, orderStatus, category]);

  useEffect(() => {
    adminApi.listCategories().then(setCategories).catch(() => {});
  }, []);

  const applyPreset = (p) => {
    setDateFrom(p.from());
    setDateTo(p.to());
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const blob = await adminApi.exportAnalyticsPdf(dateFrom, dateTo, filters);
      downloadBlob(blob, `analytics-${dateFrom}-to-${dateTo}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const blob = await adminApi.exportAnalyticsExcel(dateFrom, dateTo, filters);
      downloadBlob(blob, `analytics-${dateFrom}-to-${dateTo}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-semibold text-ink">Analytics</h1>
        <div className="flex gap-2">
          <button onClick={exportPdf} disabled={exporting} className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-black/5 disabled:opacity-50">
            <Download size={14} /> PDF
          </button>
          <button onClick={exportExcel} disabled={exporting} className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-black/5 disabled:opacity-50">
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-black/5">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => applyPreset(p)} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-black/5">
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-sm outline-none" />
          <span className="text-ink/30">→</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-sm outline-none" />
        </div>
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm">
          <option value="">All payment methods</option>
          <option value="COD">Cash on Delivery</option>
          <option value="ONLINE">Online</option>
        </select>
        <select value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-black/5" />)}
        </div>
      ) : error ? (
        <div className="mt-6 rounded-xl border border-black/5 bg-white p-8 text-center text-sm font-medium text-red-500">{error}</div>
      ) : (
        <>
          <KpiGrid kpis={data.kpis} />

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Revenue trend">
              {data.revenue_orders_series.length === 0 ? <EmptyState /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={data.revenue_orders_series}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1B4332" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#1B4332" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`₹${v}`, "Revenue"]} />
                    <Area type="monotone" dataKey="revenue" stroke="#1B4332" fill="url(#rev)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Orders vs Revenue">
              {data.revenue_orders_series.length === 0 ? <EmptyState /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.revenue_orders_series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#1B4332" name="Revenue (₹)" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#E8A33D" name="Orders" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <LowStockCard products={data.low_stock_products} />
            <DonutCard title="Sales by category" items={data.category_sales.map((c) => ({ name: c.name, value: c.revenue, sub: `${c.qty} sold` }))} />
            <PaymentDonutCard payment={data.payment_analytics} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <OrderStatusCard summary={data.order_status_summary} />
            <CustomerInsightsCard insights={data.customer_insights} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <TopCustomersCard customers={data.top_customers} />
            <RecentOrdersCard orders={data.recent_orders} />
          </div>

          <div className="mt-4">
            <DeliveryAnalyticsCard delivery={data.delivery_analytics} />
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return <div className="flex h-48 items-center justify-center text-sm text-ink/40">No data available for this range.</div>;
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function KpiGrid({ kpis }) {
  const money = (v) => `₹${v.toLocaleString("en-IN")}`;
  const cards = [
    { label: "Revenue", value: money(kpis.revenue.value), change: kpis.revenue.change_pct },
    { label: "Orders", value: kpis.orders.value, change: kpis.orders.change_pct },
    { label: "Avg Order Value", value: money(kpis.average_order_value.value), change: kpis.average_order_value.change_pct },
    { label: "Unique Customers", value: kpis.unique_customers.value, change: kpis.unique_customers.change_pct },
    { label: "Repeat Customers", value: kpis.repeat_customers.value, change: null },
    { label: "Active Deliveries", value: kpis.active_deliveries.value, change: null },
    { label: "Cancelled Orders", value: kpis.cancelled_orders.value, change: kpis.cancelled_orders.change_pct, invert: true },
    { label: "COD Pending", value: money(kpis.cod_pending_amount.value), change: null, warn: kpis.cod_pending_amount.value > 0 },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/40">{c.label}</p>
          <p className={`mt-1 text-xl font-semibold ${c.warn ? "text-turmeric-dark" : "text-ink"}`}>{c.value}</p>
          {c.change !== null && c.change !== undefined && (
            <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${(c.invert ? c.change <= 0 : c.change >= 0) ? "text-forest" : "text-red-500"}`}>
              {(c.invert ? c.change <= 0 : c.change >= 0) ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(c.change)}% vs previous period
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function LowStockCard({ products }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-1.5 font-semibold text-ink"><AlertTriangle size={16} className="text-turmeric-dark" /> Low stock products</h2>
      {products.length === 0 ? (
        <p className="mt-3 text-sm text-ink/40">Nothing low on stock right now.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg bg-[#F5F6F8] p-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white text-sm">
                {p.image ? <img src={resolveImageUrl(p.image)} alt="" className="h-full w-full rounded object-contain" /> : "🥛"}
              </div>
              <span className="flex-1 truncate text-sm text-ink">{p.name}</span>
              <span className={`badge ${p.status === "Out of stock" ? "bg-red-100 text-red-600" : "bg-turmeric/20 text-turmeric-dark"}`}>
                {p.stock} left
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DonutCard({ title, items }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-ink">{title}</h2>
      {items.length === 0 || total === 0 ? <EmptyState /> : (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={items} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                {items.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `₹${v}`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {items.map((i, idx) => (
              <div key={i.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: DONUT_COLORS[idx % DONUT_COLORS.length] }} />{i.name}</span>
                <span className="text-ink/60">₹{i.value} {i.sub && `· ${i.sub}`}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PaymentDonutCard({ payment }) {
  const items = [
    { name: "Online (paid)", value: payment.online_paid.amount, sub: `${payment.online_paid.count} orders` },
    { name: "Cash on Delivery", value: payment.cod.amount, sub: `${payment.cod.count} orders` },
    { name: "Pending", value: payment.pending.amount, sub: `${payment.pending.count} orders` },
  ];
  return <DonutCard title="Payment breakdown" items={items} />;
}

function OrderStatusCard({ summary }) {
  const total = Object.values(summary).reduce((a, b) => a + b, 0);
  return (
    <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-ink">Order status summary</h2>
      {total === 0 ? <EmptyState /> : (
        <div className="mt-3 space-y-2">
          {Object.entries(summary).map(([status, count]) => (
            <div key={status}>
              <div className="flex items-center justify-between text-sm">
                <span className={`badge ${STATUS_COLOR[status] || "bg-black/5 text-ink"}`}>{STATUS_LABEL[status] || status}</span>
                <span className="text-ink/60">{count}</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-black/5">
                <div className="h-1.5 rounded-full bg-forest" style={{ width: `${(count / total) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerInsightsCard({ insights }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-ink">Customer insights</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Stat label="New customers" value={insights.new_customers} />
        <Stat label="Returning customers" value={insights.returning_customers} />
        <Stat label="Retention rate" value={`${insights.retention_rate}%`} />
        <Stat label="Avg orders/customer" value={insights.avg_orders_per_customer} />
      </div>
      {insights.highest_spender && (
        <div className="mt-3 rounded-lg bg-forest/5 p-3 text-sm">
          <p className="text-ink/60">Highest spender</p>
          <p className="font-medium text-ink">{insights.highest_spender.name} — ₹{insights.highest_spender.total_spent}</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-xs text-ink/40">{label}</p>
      <p className="font-semibold text-ink">{value}</p>
    </div>
  );
}

function TopCustomersCard({ customers }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-ink">Top customers</h2>
      {customers.length === 0 ? <EmptyState /> : (
        <div className="mt-3 divide-y divide-black/5">
          {customers.slice(0, 8).map((c) => (
            <div key={c.user_id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium text-ink">{c.name}</p>
                <p className="text-xs text-ink/40">{c.order_count} orders · last {new Date(c.last_order_at).toLocaleDateString()}</p>
              </div>
              <p className="font-semibold text-ink">₹{c.total_spent}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentOrdersCard({ orders }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-ink">Recent orders</h2>
      {orders.length === 0 ? <EmptyState /> : (
        <div className="mt-3 divide-y divide-black/5">
          {orders.map((o) => (
            <div key={o.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium text-ink">#{o.order_number} — {o.customer_name}</p>
                <p className="text-xs text-ink/40">{new Date(o.created_at).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-ink">₹{o.total}</p>
                <span className={`badge ${STATUS_COLOR[o.status] || "bg-black/5 text-ink"}`}>{STATUS_LABEL[o.status] || o.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryAnalyticsCard({ delivery }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-ink">Delivery analytics</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
        <Stat label="Active deliveries" value={delivery.active_deliveries} />
        <Stat label="Delivered (range)" value={delivery.delivered_count} />
        <Stat label="Avg delivery time" value={delivery.avg_delivery_minutes != null ? `${delivery.avg_delivery_minutes} min` : "—"} />
        <Stat label="Fastest delivery" value={delivery.fastest_delivery_minutes != null ? `${delivery.fastest_delivery_minutes} min` : "—"} />
        <Stat label="On-time %" value={delivery.on_time_pct != null ? `${delivery.on_time_pct}%` : "—"} />
      </div>
    </div>
  );
}
