import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useDeliveryAuth } from "./DeliveryAuthContext";

export default function DeliveryLogin() {
  const { login, logout } = useDeliveryAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from || "/delivery";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser.role !== "delivery_partner") {
        logout();
        setError("This account isn't registered as a delivery partner.");
        return;
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed. Check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="text-3xl">🛵</span>
          <h1 className="mt-2 font-display text-2xl font-semibold text-cream">Katlkar Dairy — Delivery</h1>
          <p className="mt-1 text-sm text-cream/50">Delivery partner sign-in</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl2 bg-white p-6 shadow-lg">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-forest/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/40"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">Password</label>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-forest/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/40"
            />
          </div>
          {error && <p className="text-sm font-medium text-red-500">{error}</p>}
          <button
            type="submit" disabled={submitting}
            className="w-full rounded-full bg-forest px-6 py-3 font-semibold text-cream hover:bg-forest-light disabled:opacity-50"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-cream/50">
          Not a delivery partner? <Link to="/login" className="font-semibold text-turmeric underline">Customer login</Link>
        </p>
      </div>
    </div>
  );
}
