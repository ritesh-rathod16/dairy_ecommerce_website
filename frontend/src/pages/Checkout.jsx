import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useCart } from "../context/CartContext";

export default function Checkout() {
  const { cart, refreshCart } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({ label: "Home", line1: "", line2: "", city: "", pincode: "", lat: null, lng: null });
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Location isn't available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        setLocating(false);
      },
      () => {
        setError("Couldn't access your location. You can still enter your address manually.");
        setLocating(false);
      }
    );
  };

  const placeOrder = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.line1 || !form.city || !form.pincode) {
      setError("Please fill in your full delivery address.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await client.post("/orders", {
        address: form,
        payment_method: paymentMethod,
        notes: notes || undefined,
      });
      await refreshCart();
      navigate(`/orders/${res.data.id}`, { state: { justPlaced: true } });
    } catch (err) {
      setError(err.response?.data?.detail || "Could not place order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Checkout</h1>

      <form onSubmit={placeOrder} className="mt-6 space-y-4 rounded-xl2 bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-ink">Delivery address</h2>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Label" value={form.label} onChange={update("label")} placeholder="Home / Work" />
          <Field label="Pincode" value={form.pincode} onChange={update("pincode")} placeholder="440001" required />
        </div>
        <Field label="Address line 1" value={form.line1} onChange={update("line1")} placeholder="House no, street" required />
        <Field label="Address line 2" value={form.line2} onChange={update("line2")} placeholder="Landmark (optional)" />
        <Field label="City" value={form.city} onChange={update("city")} placeholder="City" required />

        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="text-sm font-semibold text-forest underline disabled:opacity-50"
        >
          {locating ? "Locating..." : form.lat ? "📍 Location captured" : "📍 Use my current location"}
        </button>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">Delivery notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-forest/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/40"
            placeholder="E.g. leave with security guard"
          />
        </div>

        <h2 className="pt-2 font-display text-lg font-semibold text-ink">Payment</h2>
        <div className="space-y-2">
          <label className="flex items-center gap-2 rounded-lg border border-forest/20 px-4 py-3 text-sm">
            <input type="radio" name="pm" checked={paymentMethod === "COD"} onChange={() => setPaymentMethod("COD")} />
            <span className="font-medium text-ink">Cash on Delivery</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-forest/20 px-4 py-3 text-sm">
            <input type="radio" name="pm" checked={paymentMethod === "ONLINE"} onChange={() => setPaymentMethod("ONLINE")} />
            <span className="font-medium text-ink">Pay online (UPI / Card)</span>
          </label>
        </div>

        <div className="border-t border-forest/10 pt-4">
          <div className="flex justify-between text-sm text-ink/70"><span>Subtotal</span><span>₹{cart.subtotal}</span></div>
          <div className="flex justify-between text-sm text-ink/70"><span>Delivery</span><span>{cart.delivery_fee === 0 ? "FREE" : `₹${cart.delivery_fee}`}</span></div>
          <div className="mt-1 flex justify-between font-semibold text-ink"><span>Total</span><span>₹{cart.total}</span></div>
        </div>

        {error && <p className="text-sm font-medium text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting || cart.items.length === 0}
          className="w-full rounded-full bg-forest px-6 py-3 font-semibold text-cream hover:bg-forest-light disabled:opacity-50"
        >
          {submitting ? "Placing order..." : `Place order · ₹${cart.total}`}
        </button>
      </form>
    </div>
  );
}

function Field({ label, required, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink/70">
        {label} {required && <span className="text-turmeric-dark">*</span>}
      </label>
      <input
        {...props}
        className="w-full rounded-lg border border-forest/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/40"
      />
    </div>
  );
}
