import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { resolveImageUrl } from "../api/client";

export default function ProductCard({ product }) {
  const { user } = useAuth();
  const { cart, addToCart, removeFromCart } = useCart();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const inCart = cart.items.find((i) => i.product_id === product.id);
  const discount = product.mrp > product.price
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0;

  const handleAdd = async (qty) => {
    if (!user) {
      navigate("/login");
      return;
    }
    setBusy(true);
    try {
      if (qty <= 0) {
        await removeFromCart(product.id);
      } else {
        await addToCart(product.id, qty);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group flex flex-col rounded-xl2 border border-forest/10 bg-white p-3 shadow-sm transition hover:shadow-md">
      <Link to={`/product/${product.slug}`} className="flex flex-col flex-1">
        <div className="relative mb-3 flex h-28 items-center justify-center rounded-lg bg-cream text-4xl">
          {product.image ? (
            <img src={resolveImageUrl(product.image)} alt={product.name} className="h-full w-full rounded-lg object-contain p-1" />
          ) : (
            "🥛"
          )}
          {discount > 0 && (
            <span className="badge absolute left-2 top-2 bg-turmeric text-ink">{discount}% OFF</span>
          )}
        </div>
        <p className="text-xs uppercase tracking-wide text-forest-light">{product.unit}</p>
        <h3 className="font-display text-base font-semibold text-ink leading-snug">{product.name}</h3>
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <div>
          <span className="font-semibold text-ink">₹{product.price}</span>
          {product.mrp > product.price && (
            <span className="ml-1 text-xs text-ink/40 line-through">₹{product.mrp}</span>
          )}
        </div>

        {!product.is_available || product.stock === 0 ? (
          <span className="text-xs font-semibold text-red-500">Out of stock</span>
        ) : inCart ? (
          <QuantityStepper
            quantity={inCart.quantity}
            stock={product.stock}
            busy={busy}
            onChange={handleAdd}
          />
        ) : (
          <button
            onClick={() => handleAdd(1)}
            disabled={busy}
            className="rounded-full border border-forest px-3 py-1 text-sm font-semibold text-forest transition hover:bg-forest hover:text-cream disabled:opacity-50"
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}

function QuantityStepper({ quantity, stock, busy, onChange }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-forest px-2 py-1 text-cream">
      <button disabled={busy} onClick={() => onChange(quantity - 1)} className="w-5 font-bold disabled:opacity-50">
        {quantity === 1 ? "×" : "−"}
      </button>
      <span className="w-4 text-center text-sm font-semibold">{quantity}</span>
      <button
        disabled={busy || quantity >= stock}
        onClick={() => onChange(quantity + 1)}
        className="w-5 font-bold disabled:opacity-50"
      >
        +
      </button>
    </div>
  );
}
