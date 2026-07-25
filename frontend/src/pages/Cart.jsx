import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { resolveImageUrl } from "../api/client";

export default function Cart() {
  const { cart, addToCart, removeFromCart } = useCart();
  const navigate = useNavigate();

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-5xl">🛒</p>
        <h2 className="mt-4 font-display text-xl font-semibold text-ink">Your cart is empty</h2>
        <p className="mt-1 text-ink/60">Add some fresh dairy to get started.</p>
        <Link to="/" className="mt-6 inline-block rounded-full bg-forest px-6 py-3 font-semibold text-cream hover:bg-forest-light">
          Browse products
        </Link>
      </div>
    );
  }

  const amountToFreeDelivery = Math.max(0, cart.free_delivery_limit - cart.subtotal);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Your Cart</h1>

      {amountToFreeDelivery > 0 ? (
        <p className="mt-2 rounded-lg bg-turmeric/20 px-4 py-2 text-sm text-ink">
          Add ₹{amountToFreeDelivery.toFixed(0)} more to get <span className="font-semibold">free delivery</span>.
        </p>
      ) : (
        <p className="mt-2 rounded-lg bg-forest/10 px-4 py-2 text-sm font-medium text-forest">
          🎉 You've unlocked free delivery!
        </p>
      )}

      <div className="mt-4 divide-y divide-forest/10 rounded-xl2 bg-white shadow-sm">
        {cart.items.map((item) => (
          <div key={item.product_id} className="flex items-center gap-4 p-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-cream text-2xl">
              {item.image ? (
                <img src={resolveImageUrl(item.image)} alt={item.name} className="h-full w-full rounded-lg object-contain p-1" />
              ) : (
                "🥛"
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-ink">{item.name}</p>
              <p className="text-sm text-ink/60">{item.unit} · ₹{item.price} each</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-forest px-2 py-1 text-cream">
              <button
                onClick={() => (item.quantity === 1 ? removeFromCart(item.product_id) : addToCart(item.product_id, item.quantity - 1))}
                className="w-5 font-bold"
              >
                {item.quantity === 1 ? "×" : "−"}
              </button>
              <span className="w-4 text-center text-sm font-semibold">{item.quantity}</span>
              <button
                disabled={item.quantity >= item.stock}
                onClick={() => addToCart(item.product_id, item.quantity + 1)}
                className="w-5 font-bold disabled:opacity-50"
              >
                +
              </button>
            </div>
            <p className="w-16 text-right font-semibold text-ink">₹{item.line_total}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-1 rounded-xl2 bg-white p-4 shadow-sm">
        <Row label="Subtotal" value={`₹${cart.subtotal}`} />
        <Row label="Delivery fee" value={cart.delivery_fee === 0 ? "FREE" : `₹${cart.delivery_fee}`} />
        <div className="my-2 border-t border-forest/10" />
        <Row label="Total" value={`₹${cart.total}`} bold />
      </div>

      <button
        onClick={() => navigate("/checkout")}
        className="mt-6 w-full rounded-full bg-turmeric px-6 py-3 font-semibold text-ink hover:bg-turmeric-dark"
      >
        Proceed to checkout
      </button>
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
