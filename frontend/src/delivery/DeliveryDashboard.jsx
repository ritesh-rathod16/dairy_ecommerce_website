import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell, Phone, MessageCircle, Copy, XCircle, IndianRupee, QrCode,
  History,
} from "lucide-react";
import { useDeliveryAuth } from "./DeliveryAuthContext";
import { deliveryApi } from "./deliveryApi";
import deliveryClient from "../api/deliveryClient";
import { resolveImageUrl } from "../api/client";
import MapEmbed from "../components/MapEmbed";
import ChangePasswordForm from "../components/ChangePasswordForm";
import { enablePushNotifications, pushPermissionStatus } from "../utils/push";

const STAGE_FLOW = [
  { stage: "assigned", label: "New order", action: "Accept order", next: "accepted" },
  { stage: "accepted", label: "Accepted", action: "Navigate to store", next: "heading_to_store", isNav: "store" },
  { stage: "heading_to_store", label: "Heading to store", action: "Reached store", next: "reached_store" },
  { stage: "reached_store", label: "At store", action: "Order packed", next: "packed" },
  { stage: "packed", label: "Packed", action: "Picked up", next: "picked_up" },
  { stage: "picked_up", label: "Picked up", action: "Start delivery", next: "heading_to_customer" },
  { stage: "heading_to_customer", label: "On the way", action: "Reached customer", next: "reached_customer", isNav: "customer" },
  { stage: "reached_customer", label: "At customer", action: "Mark delivered", next: "delivered" },
];
const STAGE_INDEX = Object.fromEntries(STAGE_FLOW.map((s, i) => [s.stage, i]));

const REJECT_REASONS = ["Vehicle issue", "Too far", "Emergency", "Cannot contact customer", "Already busy", "Other"];

export default function DeliveryDashboard() {
  const { user, logout } = useDeliveryAuth();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [lastPing, setLastPing] = useState(null);
  const [liveCoords, setLiveCoords] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [showAccount, setShowAccount] = useState(false);
  const [pushStatus, setPushStatus] = useState(pushPermissionStatus());
  const watchIdRef = useRef(null);

  const load = () => deliveryApi.myOrders().then(setOrders).catch(() => {});
  const loadStats = () => deliveryApi.getStats().then(setStats).catch(() => {});

  useEffect(() => {
    load();
    loadStats();
    const interval = setInterval(() => { load(); loadStats(); }, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const handleEnablePush = async () => {
    const result = await enablePushNotifications(deliveryClient);
    if (result === "subscribed") setPushStatus("granted");
    else if (result === "denied") setPushStatus("denied");
    else if (result === "unavailable") alert("Push notifications aren't configured on this server yet.");
    else if (result === "unsupported") alert("Push notifications need a production build — they're disabled in dev mode.");
  };

  const toggleSharing = () => {
    if (sharing) {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setSharing(false);
      return;
    }
    if (!navigator.geolocation) {
      setError("Location isn't available in this browser.");
      return;
    }
    setError("");
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        setLiveCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        try {
          await deliveryApi.sendLocation(pos.coords.latitude, pos.coords.longitude);
          setLastPing(new Date());
        } catch {
          // Non-fatal — next ping will retry.
        }
      },
      () => setError("Couldn't access your location. Enable location permissions and try again."),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    setSharing(true);
  };

  const advanceStage = async (orderId, nextStage) => {
    setBusyId(orderId);
    setError("");
    try {
      await deliveryApi.updateStage(orderId, nextStage);
      load();
      loadStats();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update this order.");
    } finally {
      setBusyId(null);
    }
  };

  const rejectOrder = async (orderId, reason) => {
    setBusyId(orderId);
    try {
      await deliveryApi.reject(orderId, reason);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not reject this order.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-between bg-forest px-4 py-3 text-cream">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛵</span>
          <span className="font-display font-semibold">Katlkar Dairy — Delivery</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {pushStatus !== "granted" && (
            <button onClick={handleEnablePush} className="flex items-center gap-1 rounded-full bg-forest-dark px-3 py-1 hover:bg-forest-light transition">
              <Bell size={14} /> Enable alerts
            </button>
          )}
          <Link to="/delivery/history" className="flex items-center gap-1 rounded-full bg-forest-dark px-3 py-1 hover:bg-forest-light transition">
            <History size={14} /> History
          </Link>
          <span className="text-cream/70">{user?.name}</span>
          <button onClick={() => setShowAccount((s) => !s)} className="rounded-full bg-forest-dark px-3 py-1 hover:bg-forest-light transition">
            Account
          </button>
          <button onClick={logout} className="rounded-full bg-forest-dark px-3 py-1 hover:bg-forest-light transition">
            Log out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {showAccount && (
          <div className="mb-4 space-y-4">
            {stats?.profile && (
              <div className="rounded-xl2 bg-white p-4 shadow-sm">
                <h2 className="font-display font-semibold text-ink">Profile</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-ink/40">Name</p>
                    <p className="font-medium text-ink">{stats.profile.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink/40">Phone</p>
                    <p className="font-medium text-ink">{stats.profile.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink/40">Joined</p>
                    <p className="font-medium text-ink">{stats.profile.joined_at ? new Date(stats.profile.joined_at).toLocaleDateString() : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink/40">Total completed deliveries</p>
                    <p className="font-medium text-ink">{stats.performance.total_completed}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink/40">Avg delivery time</p>
                    <p className="font-medium text-ink">{stats.performance.avg_delivery_minutes != null ? `${stats.performance.avg_delivery_minutes} min` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink/40">Fastest delivery</p>
                    <p className="font-medium text-ink">{stats.performance.fastest_delivery_minutes != null ? `${stats.performance.fastest_delivery_minutes} min` : "—"}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="rounded-xl2 bg-white p-4 shadow-sm">
              <h2 className="font-display font-semibold text-ink">Change password</h2>
              <div className="mt-3">
                <ChangePasswordForm client={deliveryClient} />
              </div>
            </div>
          </div>
        )}

        {stats && <StatsPanel stats={stats} />}

        <div className="mt-4 rounded-xl2 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display font-semibold text-ink">Live Location</p>
              <p className="text-sm text-ink/60">
                Status: <span className={sharing ? "font-semibold text-forest" : "font-semibold text-ink/40"}>{sharing ? "LIVE" : "OFF"}</span>
                {sharing && lastPing && <span className="ml-2 text-ink/40">Last updated: {Math.max(0, Math.round((Date.now() - lastPing) / 1000))}s ago</span>}
              </p>
            </div>
            <button
              onClick={toggleSharing}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${sharing ? "bg-red-500 text-white" : "bg-forest text-cream"}`}
            >
              {sharing ? "Stop sharing" : "Start sharing"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm font-medium text-red-500">{error}</p>}
        </div>

        <h2 className="mt-6 font-display text-xl font-semibold text-ink">Your deliveries</h2>

        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-ink/50">No orders assigned to you right now.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {orders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                busy={busyId === o.id}
                liveCoords={liveCoords}
                onAdvance={(next) => advanceStage(o.id, next)}
                onReject={(reason) => rejectOrder(o.id, reason)}
                onPaid={() => { load(); loadStats(); }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatsPanel({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="Today: completed" value={stats.today.completed} />
      <Stat label="Today: pending" value={stats.today.pending} />
      <Stat label="Cash collected today" value={`₹${stats.today.cash_collected}`} />
      <Stat label="UPI collected today" value={`₹${stats.today.upi_collected}`} />
      <Stat label="Pending payments" value={`₹${stats.pending_payments.amount} (${stats.pending_payments.count})`} warn={stats.pending_payments.count > 0} />
      <Stat label="This week" value={stats.performance.this_week_completed} />
      <Stat label="This month" value={stats.performance.this_month_completed} />
      <Stat label="Avg delivery time" value={stats.performance.avg_delivery_minutes != null ? `${stats.performance.avg_delivery_minutes} min` : "—"} />
    </div>
  );
}

function Stat({ label, value, warn }) {
  return (
    <div className="rounded-xl2 bg-white p-3 shadow-sm">
      <p className="text-[11px] text-ink/40">{label}</p>
      <p className={`text-lg font-semibold ${warn ? "text-turmeric-dark" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function OrderCard({ order: o, busy, liveCoords, onAdvance, onReject, onPaid }) {
  const [route, setRoute] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [qrUrl, setQrUrl] = useState(null);
  const [markingPaid, setMarkingPaid] = useState(null);
  const [paymentError, setPaymentError] = useState("");
  const [showReject, setShowReject] = useState(false);

  const stageIdx = STAGE_INDEX[o.delivery_stage] ?? 0;
  const currentStep = STAGE_FLOW[stageIdx];
  const isUnpaid = o.payment_status !== "paid";
  const canReject = stageIdx <= STAGE_INDEX["packed"];

  const loadMap = async () => {
    if (showMap) { setShowMap(false); return; }
    setShowMap(true);
    if (!route) {
      setLoadingRoute(true);
      try {
        setRoute(await deliveryApi.getRoute(o.id));
      } catch {
        setRoute({ warning: "Could not load map info." });
      } finally {
        setLoadingRoute(false);
      }
    }
  };

  const handleAction = async () => {
    if (currentStep.isNav === "store" && route?.store?.nav_link) window.open(route.store.nav_link, "_blank");
    if (currentStep.isNav === "customer" && route?.customer_nav_link) window.open(route.customer_nav_link, "_blank");
    onAdvance(currentStep.next);
  };

  const togglePayment = async () => {
    if (showPayment) { setShowPayment(false); return; }
    setShowPayment(true);
    if (!qrUrl) {
      try {
        const blob = await deliveryApi.getQr(o.id);
        setQrUrl(URL.createObjectURL(blob));
      } catch {
        setPaymentError("Could not load QR code.");
      }
    }
  };

  const collectPayment = async (method) => {
    setMarkingPaid(method);
    setPaymentError("");
    try {
      await deliveryApi.markPaid(o.id, method);
      onPaid();
    } catch (err) {
      setPaymentError(err.response?.data?.detail || "Could not mark this order paid.");
    } finally {
      setMarkingPaid(null);
    }
  };

  const copyAddress = () => {
    const text = `${o.address.line1}${o.address.line2 ? ", " + o.address.line2 : ""}, ${o.address.city} - ${o.address.pincode}`;
    navigator.clipboard?.writeText(text);
  };

  return (
    <div className="rounded-xl2 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-ink">#{o.order_number}</p>
        <span className="badge bg-forest/10 text-forest">{currentStep.label}</span>
      </div>

      {o.customer && (
        <div className="mt-2 rounded-lg bg-cream/60 px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink">{o.customer.name}</span>
            <div className="flex gap-2">
              {o.customer.phone && (
                <>
                  <a href={`tel:${o.customer.phone}`} className="flex items-center gap-1 font-medium text-forest" title="Call">
                    <Phone size={13} />
                  </a>
                  <a href={`https://wa.me/91${o.customer.phone}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-medium text-forest" title="WhatsApp">
                    <MessageCircle size={13} />
                  </a>
                </>
              )}
              <button onClick={copyAddress} className="flex items-center gap-1 font-medium text-forest" title="Copy address">
                <Copy size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {o.items.map((i) => (
          <div key={i.product_id} className="flex items-center gap-1.5 rounded-lg bg-cream/60 px-2 py-1">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-white text-xs">
              {i.image ? <img src={resolveImageUrl(i.image)} alt="" className="h-full w-full rounded object-contain" /> : "🥛"}
            </div>
            <span className="text-xs text-ink/70">{i.name} × {i.quantity}</span>
          </div>
        ))}
      </div>
      <p className="mt-1 text-sm text-ink/60">
        {o.address.line1}, {o.address.line2 ? `${o.address.line2}, ` : ""}{o.address.city} - {o.address.pincode}
      </p>
      {o.notes && <p className="mt-1 text-xs italic text-ink/50">Note: {o.notes}</p>}

      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs font-medium text-ink/60">{o.payment_method === "COD" ? "Cash on Delivery" : "Online payment"}</span>
        <span className={`badge ${o.payment_status === "paid" ? "bg-forest/10 text-forest" : o.payment_status === "pending_verification" ? "bg-turmeric/20 text-turmeric-dark" : "bg-red-100 text-red-600"}`}>
          {o.payment_status === "paid" ? "Paid" : o.payment_status === "pending_verification" ? "Pending verification" : "Unpaid"}
        </span>
        <span className="text-xs text-ink/40">₹{o.total} {isUnpaid && "due"}</span>
      </div>

      {isUnpaid && (
        <div className="mt-2">
          <button onClick={togglePayment} className="flex items-center gap-1 text-xs font-semibold text-forest underline">
            <QrCode size={12} /> {showPayment ? "Hide payment collection" : "Collect payment"}
          </button>
          {showPayment && (
            <div className="mt-2 rounded-lg border border-forest/10 bg-cream/40 p-3 text-xs">
              <p className="font-medium text-ink">Amount Due: ₹{o.total}</p>
              <button
                onClick={() => collectPayment("cash")}
                disabled={markingPaid !== null}
                className="mt-2 flex items-center gap-1 rounded-full bg-forest px-3 py-2 text-xs font-semibold text-cream hover:bg-forest-light disabled:opacity-50"
              >
                <IndianRupee size={12} /> {markingPaid === "cash" ? "Confirming..." : "Cash Received"}
              </button>

              <div className="mt-3 flex flex-col items-center gap-2 border-t border-forest/10 pt-3">
                <p className="font-medium text-ink">Or scan to pay via UPI</p>
                {qrUrl ? (
                  <img src={qrUrl} alt="UPI payment QR" className="h-36 w-36 rounded-lg bg-white p-2" />
                ) : (
                  <div className="flex h-36 w-36 items-center justify-center text-ink/40">Loading QR...</div>
                )}
                <button
                  onClick={() => collectPayment("upi")}
                  disabled={markingPaid !== null}
                  className="rounded-full bg-turmeric px-4 py-2 text-xs font-semibold text-ink hover:bg-turmeric-dark disabled:opacity-50"
                >
                  {markingPaid === "upi" ? "Confirming..." : "Confirm UPI Received"}
                </button>
              </div>
              {paymentError && <p className="mt-2 font-medium text-red-500">{paymentError}</p>}
            </div>
          )}
        </div>
      )}

      <button onClick={loadMap} className="mt-2 flex items-center gap-1 text-xs font-semibold text-forest underline">
        {showMap ? "Hide map" : "Show map & navigate"}
      </button>

      {showMap && (
        <div className="mt-2">
          {loadingRoute ? (
            <p className="text-xs text-ink/50">Loading map...</p>
          ) : (
            <>
              <MapEmbed
                storeLat={route?.store?.lat} storeLng={route?.store?.lng}
                customerLat={route?.customer_lat} customerLng={route?.customer_lng}
                riderLat={liveCoords?.lat} riderLng={liveCoords?.lng}
              />
              {route?.route && (
                <p className="mt-1 text-xs font-medium text-ink">
                  Distance: {route.route.distance_km} km · ETA: {Math.round(route.route.duration_minutes)} minutes
                </p>
              )}
              {route?.warning && <p className="mt-1 text-xs text-turmeric-dark">{route.warning}</p>}
              <div className="mt-2 flex gap-2">
                {route?.store?.nav_link && (
                  <a href={route.store.nav_link} target="_blank" rel="noreferrer" className="rounded-full border border-forest/30 px-3 py-1 text-xs font-semibold text-forest">
                    Navigate to Store
                  </a>
                )}
                {route?.customer_nav_link && (
                  <a href={route.customer_nav_link} target="_blank" rel="noreferrer" className="rounded-full border border-forest/30 px-3 py-1 text-xs font-semibold text-forest">
                    Navigate to Customer
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {currentStep.next && (
          <button
            onClick={handleAction}
            disabled={busy}
            className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-cream hover:bg-forest-light disabled:opacity-50"
          >
            {currentStep.action}
          </button>
        )}
        {canReject && (
          <button
            onClick={() => setShowReject(true)}
            disabled={busy}
            className="flex items-center gap-1 rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50"
          >
            <XCircle size={14} /> Reject
          </button>
        )}
      </div>

      {showReject && (
        <RejectModal
          onCancel={() => setShowReject(false)}
          onConfirm={(reason) => { setShowReject(false); onReject(reason); }}
        />
      )}
    </div>
  );
}

function RejectModal({ onCancel, onConfirm }) {
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [other, setOther] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="font-semibold text-ink">Why are you rejecting?</h2>
        <div className="mt-3 space-y-2">
          {REJECT_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input type="radio" name="reject-reason" checked={reason === r} onChange={() => setReason(r)} />
              {r}
            </label>
          ))}
        </div>
        {reason === "Other" && (
          <input
            value={other} onChange={(e) => setOther(e.target.value)}
            placeholder="Tell us more..."
            className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          />
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onConfirm(reason === "Other" ? (other || "Other") : reason)}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Confirm reject
          </button>
          <button onClick={onCancel} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold text-ink">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
