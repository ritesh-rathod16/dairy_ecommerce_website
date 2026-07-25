import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register(form.name, form.email, form.phone, form.password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not create account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-center font-display text-2xl font-semibold text-ink">Create your account</h1>
      <p className="mt-1 text-center text-ink/60">Join Katlkar Dairy in under a minute.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl2 bg-white p-6 shadow-sm">
        <TextField label="Full name" value={form.name} onChange={update("name")} required />
        <TextField label="Email" type="email" value={form.email} onChange={update("email")} required />
        <TextField label="Phone" value={form.phone} onChange={update("phone")} required />
        <TextField label="Password" type="password" value={form.password} onChange={update("password")} required minLength={6} />
        {error && <p className="text-sm font-medium text-red-500">{error}</p>}
        <button
          type="submit" disabled={submitting}
          className="w-full rounded-full bg-forest px-6 py-3 font-semibold text-cream hover:bg-forest-light disabled:opacity-50"
        >
          {submitting ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-ink/60">
        Already have an account? <Link to="/login" className="font-semibold text-forest underline">Log in</Link>
      </p>
    </div>
  );
}

function TextField({ label, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink/70">{label}</label>
      <input
        {...props}
        className="w-full rounded-lg border border-forest/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/40"
      />
    </div>
  );
}
