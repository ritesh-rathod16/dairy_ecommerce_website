import React, { useState } from "react";
import defaultClient from "../api/client";

export default function ChangePasswordForm({ client = defaultClient }) {
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (field) => (e) => {
    setSuccess(false);
    setForm({ ...form, [field]: e.target.value });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.new_password !== form.confirm) {
      setError("New password and confirmation don't match.");
      return;
    }
    if (form.new_password.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      await client.post("/users/me/change-password", {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setSuccess(true);
      setForm({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      setError(err.response?.data?.detail || "Could not change password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink/70">Current password</label>
        <input
          type="password" required value={form.current_password} onChange={update("current_password")}
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-ink/70">New password</label>
        <input
          type="password" required minLength={6} value={form.new_password} onChange={update("new_password")}
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-ink/70">Confirm new password</label>
        <input
          type="password" required value={form.confirm} onChange={update("confirm")}
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
        />
      </div>
      {error && <p className="text-sm font-medium text-red-500">{error}</p>}
      {success && <p className="text-sm font-medium text-forest">Password changed.</p>}
      <button type="submit" disabled={saving}
        className="rounded-lg bg-forest px-5 py-2 text-sm font-semibold text-cream hover:bg-forest-light disabled:opacity-50">
        {saving ? "Saving..." : "Change password"}
      </button>
    </form>
  );
}
