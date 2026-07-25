import React, { useEffect, useState } from "react";
import { Tags } from "lucide-react";
import { adminApi } from "../adminApi";

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: "", slug: "", icon: "", sort_order: 0 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      setCategories(await adminApi.listCategories());
    } catch (err) {
      setLoadError(err.response?.data?.detail || "Could not load categories. Check that the backend is running.");
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
      await adminApi.createCategory({ ...form, sort_order: parseInt(form.sort_order, 10) || 0 });
      setForm({ name: "", slug: "", icon: "", sort_order: 0 });
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save category.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this category?")) return;
    try {
      await adminApi.deleteCategory(id);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not delete category.");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Categories</h1>

      <form onSubmit={submit} className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-black/5 bg-white p-5 shadow-sm md:grid-cols-4">
        <Field label="Name" value={form.name} onChange={update("name")} required />
        <Field label="Slug" value={form.slug} onChange={update("slug")} required />
        <Field label="Icon (emoji)" value={form.icon} onChange={update("icon")} />
        <Field label="Sort order" type="number" value={form.sort_order} onChange={update("sort_order")} />
        {error && <p className="col-span-full text-sm font-medium text-red-500">{error}</p>}
        <button type="submit" disabled={saving} className="col-span-full w-fit rounded-lg bg-forest px-5 py-2 text-sm font-semibold text-cream hover:bg-forest-light disabled:opacity-50">
          {saving ? "Saving..." : "Add category"}
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-black/5 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-black/5" />)}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <p className="text-sm font-medium text-red-500">{loadError}</p>
            <button onClick={load} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm">Retry</button>
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-ink/40">
            <Tags size={28} />
            <p className="text-sm">No categories yet — add your first one above.</p>
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3">
                <p className="font-medium text-ink">{c.icon} {c.name} <span className="text-ink/40">({c.slug})</span></p>
                <button onClick={() => remove(c.id)} className="rounded-lg border border-red-200 px-3 py-1 text-sm text-red-500 hover:bg-red-50">Delete</button>
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
