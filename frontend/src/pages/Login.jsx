import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed. Check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-center font-display text-2xl font-semibold text-ink">Welcome back</h1>
      <p className="mt-1 text-center text-ink/60">Log in to order fresh dairy.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl2 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">Email</label>
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-forest/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/40"
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
          {submitting ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-ink/60">
        New here? <Link to="/register" className="font-semibold text-forest underline">Create an account</Link>
      </p>
    </div>
  );
}
