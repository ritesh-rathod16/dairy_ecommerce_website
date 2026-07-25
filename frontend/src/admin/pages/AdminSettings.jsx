import React, { useEffect, useState } from "react";
import { adminApi } from "../adminApi";
import adminClient from "../../api/adminClient";
import ChangePasswordForm from "../../components/ChangePasswordForm";

export default function AdminSettings() {
  const [form, setForm] = useState({ upi_id: "", merchant_name: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.getSettings()
      .then(setForm)
      .catch((err) => setError(err.response?.data?.detail || "Could not load settings."))
      .finally(() => setLoading(false));
  }, []);

  const update = (field) => (e) => {
    setSaved(false);
    setForm({ ...form, [field]: e.target.value });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const updated = await adminApi.updateSettings(form);
      setForm(updated);
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-ink">Settings</h1>
      <p className="mt-1 text-sm text-ink/50">Payment → UPI</p>

      {loading ? (
        <div className="mt-4 h-48 animate-pulse rounded-xl bg-black/5" />
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">UPI ID</label>
            <input
              value={form.upi_id} onChange={update("upi_id")}
              placeholder="yourname@upi"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-forest/30"
            />
            <p className="mt-1 text-xs text-ink/40">
              This is where customer UPI payments go. Every checkout QR code is generated
              using this ID — changing it here updates all future QR codes immediately.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">Merchant name (shown in UPI apps)</label>
            <input
              value={form.merchant_name} onChange={update("merchant_name")}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
            />
          </div>

          {error && <p className="text-sm font-medium text-red-500">{error}</p>}
          {saved && <p className="text-sm font-medium text-forest">Saved.</p>}

          <button type="submit" disabled={saving}
            className="rounded-lg bg-forest px-5 py-2 text-sm font-semibold text-cream hover:bg-forest-light disabled:opacity-50">
            {saving ? "Saving..." : "Save settings"}
          </button>
        </form>
      )}

      <div className="mt-6 rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">Account → Change password</h2>
        <div className="mt-3">
          <ChangePasswordForm client={adminClient} />
        </div>
      </div>
    </div>
  );
}
