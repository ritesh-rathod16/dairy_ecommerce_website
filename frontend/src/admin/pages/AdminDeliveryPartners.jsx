import React, { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { adminApi } from "../adminApi";

export default function AdminDeliveryPartners() {
  const [partners, setPartners] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      setPartners(await adminApi.listDeliveryPartners());
    } catch (err) {
      setLoadError(err.response?.data?.detail || "Could not load delivery partners.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await adminApi.createDeliveryPartner(form);
      setForm({ name: "", email: "", phone: "", password: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not create delivery partner.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (p) => {
    await adminApi.updateDeliveryPartnerStatus(p.id, p.status === "active" ? "suspended" : "active");
    load();
  };

  const remove = async (id) => {
    if (!confirm("Remove this delivery partner?")) return;
    try {
      await adminApi.deleteDeliveryPartner(id);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not remove this partner.");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Delivery Partners</h1>

      <form onSubmit={submit} className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-black/5 bg-white p-5 shadow-sm md:grid-cols-4">
        <Field label="Name" value={form.name} onChange={update("name")} required />
        <Field label="Email" type="email" value={form.email} onChange={update("email")} required />
        <Field label="Phone" value={form.phone} onChange={update("phone")} required />
        <Field label="Password" type="password" value={form.password} onChange={update("password")} required minLength={6} />
        {error && <p className="col-span-full text-sm font-medium text-red-500">{error}</p>}
        <button type="submit" disabled={saving} className="col-span-full w-fit rounded-lg bg-forest px-5 py-2 text-sm font-semibold text-cream hover:bg-forest-light disabled:opacity-50">
          {saving ? "Creating..." : "Add delivery partner"}
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-black/5 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-black/5" />)}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <p className="text-sm font-medium text-red-500">{loadError}</p>
            <button onClick={load} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm">Retry</button>
          </div>
        ) : partners.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-ink/40">
            <Truck size={28} />
            <p className="text-sm">No delivery partners yet — add one above.</p>
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {partners.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="font-medium text-ink">
                    {p.name}
                    {p.status === "suspended" && <span className="badge ml-2 bg-red-100 text-red-600">Suspended</span>}
                  </p>
                  <p className="text-sm text-ink/60">{p.email} · {p.phone}</p>
                  {p.last_location && (
                    <p className="text-xs text-ink/40">
                      Last seen: {new Date(p.last_location.updated_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleStatus(p)} className="rounded-lg border border-black/10 px-3 py-1 text-sm text-ink hover:bg-black/5">
                    {p.status === "active" ? "Suspend" : "Activate"}
                  </button>
                  <button onClick={() => remove(p.id)} className="rounded-lg border border-red-200 px-3 py-1 text-sm text-red-500 hover:bg-red-50">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink/70">{label}</label>
      <input {...props} className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30" />
    </div>
  );
}
