import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import client, { resolveImageUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export default function ProductDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { cart, addToCart } = useCart();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    client
      .get(`/products/${slug}`)
      .then((res) => setProduct(res.data))
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="text-ink/60">This product could not be found.</p>
        <Link to="/" className="mt-4 inline-block font-semibold text-forest underline">Back to shop</Link>
      </div>
    );
  }
  if (!product) {
    return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-forest">Loading...</div>;
  }

  const inCart = cart.items.find((i) => i.product_id === product.id);

  const handleAdd = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setBusy(true);
    try {
      await addToCart(product.id, (inCart?.quantity || 0) + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex h-64 items-center justify-center rounded-xl2 bg-white text-7xl shadow-sm">
          {product.image ? (
            <img src={resolveImageUrl(product.image)} alt={product.name} className="h-full w-full rounded-xl2 object-contain p-2" />
          ) : (
            "🥛"
          )}
        </div>
        <div>
          {product.category_name && (
            <p className="text-sm font-semibold uppercase tracking-wide text-forest-light">
              {product.category_name}
            </p>
          )}
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{product.name}</h1>
          <p className="mt-1 text-ink/60">{product.unit}</p>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">₹{product.price}</span>
            {product.mrp > product.price && (
              <span className="text-ink/40 line-through">₹{product.mrp}</span>
            )}
          </div>

          <p className="mt-4 text-ink/80 leading-relaxed">{product.description}</p>

          <p className="mt-4 text-sm">
            {product.stock > 0 ? (
              <span className="text-forest-light font-medium">In stock — {product.stock} available</span>
            ) : (
              <span className="font-medium text-red-500">Out of stock</span>
            )}
          </p>

          <button
            onClick={handleAdd}
            disabled={busy || product.stock === 0 || !product.is_available}
            className="mt-6 w-full rounded-full bg-forest px-6 py-3 font-semibold text-cream transition hover:bg-forest-light disabled:opacity-50 md:w-auto"
          >
            {inCart ? `In cart · ${inCart.quantity}. Add one more` : "Add to cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
