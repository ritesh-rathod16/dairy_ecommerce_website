import React, { useEffect, useState } from "react";
import { UploadCloud, Download, Package } from "lucide-react";
import { adminApi, downloadBlob } from "../adminApi";
import { resolveImageUrl } from "../../api/client";

const EMPTY_FORM = {
  name: "", slug: "", description: "", category_id: "", price: "", mrp: "",
  unit: "", stock: "", is_available: true, gst_percent: 0, tags: "", image: "",
};

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [p, c] = await Promise.all([adminApi.listProducts(), adminApi.listCategories()]);
      setProducts(p);
      setCategories(c);
    } catch (err) {
      setLoadError(err.response?.data?.detail || "Could not load products. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (field) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm({ ...form, [field]: val });
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name, slug: p.slug, description: p.description, category_id: p.category_id,
      price: p.price, mrp: p.mrp, unit: p.unit, stock: p.stock,
      is_available: p.is_available, gst_percent: p.gst_percent, tags: (p.tags || []).join(", "),
      image: p.image || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { url } = await adminApi.uploadImage(file);
      setForm((f) => ({ ...f, image: url }));
    } catch (err) {
      setError(err.response?.data?.detail || "Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const payload = {
      ...form,
      price: parseFloat(form.price),
      mrp: parseFloat(form.mrp),
      stock: parseInt(form.stock, 10),
      gst_percent: parseFloat(form.gst_percent) || 0,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      image: form.image || null,
    };
    try {
      if (editingId) {
        await adminApi.updateProduct(editingId, payload);
      } else {
        await adminApi.createProduct(payload);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save product.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this product?")) return;
    await adminApi.deleteProduct(id);
    load();
  };

  const exportCsv = async () => {
    const blob = await adminApi.exportCsv("products");
    downloadBlob(blob, "products.csv");
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Products</h1>
        <button onClick={exportCsv} className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-black/5">
          <Download size={15} /> Export CSV
        </button>
      </div>

      <form onSubmit={submit} className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-black/5 bg-white p-5 shadow-sm md:grid-cols-4">
        <Field label="Name" value={form.name} onChange={update("name")} required />
        <Field label="Slug" value={form.slug} onChange={update("slug")} required />
        <Select label="Category" value={form.category_id} onChange={update("category_id")} required>
          <option value="">Select...</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Field label="Unit (e.g. 500 ml)" value={form.unit} onChange={update("unit")} required />
        <Field label="Price (₹)" type="number" step="0.01" value={form.price} onChange={update("price")} required />
        <Field label="MRP (₹)" type="number" step="0.01" value={form.mrp} onChange={update("mrp")} required />
        <Field label="Stock" type="number" value={form.stock} onChange={update("stock")} required />
        <Field label="GST %" type="number" step="0.01" value={form.gst_percent} onChange={update("gst_percent")} />

        <div className="col-span-2 md:col-span-4">
          <label className="mb-1 block text-sm font-medium text-ink/70">Description</label>
          <textarea value={form.description} onChange={update("description")} rows={2}
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30" />
        </div>

        {/* Dual image mode: drag & drop / file picker, OR a pasted URL */}
        <div className="col-span-2 md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-ink/70">Product image — upload</label>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            className={`flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs text-ink/50 transition ${dragOver ? "border-forest bg-forest/5" : "border-black/15"}`}
          >
            <UploadCloud size={18} className={uploading ? "animate-pulse" : ""} />
            {uploading ? "Uploading..." : "Drag & drop, or click to choose a file"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
          </label>
        </div>

        <div className="col-span-2 md:col-span-2">
          <Field label="...or paste an image URL" placeholder="https://..." value={form.image} onChange={update("image")} />
          {form.image && (
            <div className="mt-2 flex items-center gap-2">
              <img src={resolveImageUrl(form.image)} alt="Preview" className="h-14 w-14 rounded-lg border border-black/10 object-contain p-0.5" />
              <button type="button" onClick={() => setForm((f) => ({ ...f, image: "" }))} className="text-xs font-medium text-red-500 underline">
                Remove
              </button>
            </div>
          )}
        </div>

        <Field label="Tags (comma separated)" value={form.tags} onChange={update("tags")} />
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-ink/70">
          <input type="checkbox" checked={form.is_available} onChange={update("is_available")} />
          Available for sale
        </label>

        {error && <p className="col-span-full text-sm font-medium text-red-500">{error}</p>}

        <div className="col-span-full flex gap-2">
          <button type="submit" disabled={saving || uploading}
            className="rounded-lg bg-forest px-5 py-2 text-sm font-semibold text-cream hover:bg-forest-light disabled:opacity-50">
            {saving ? "Saving..." : editingId ? "Update product" : "Add product"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-lg border border-black/10 px-5 py-2 text-sm font-semibold text-ink">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="mt-6 rounded-xl border border-black/5 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-black/5" />)}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <p className="text-sm font-medium text-red-500">{loadError}</p>
            <button onClick={load} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm">Retry</button>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-ink/40">
            <Package size={28} />
            <p className="text-sm">No products yet — add your first one above.</p>
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F5F6F8] text-lg">
                    {p.image ? <img src={resolveImageUrl(p.image)} alt="" className="h-full w-full rounded-lg object-contain p-0.5" /> : "🥛"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{p.name} <span className="text-ink/40">· {p.unit}</span></p>
                    <p className="text-sm text-ink/60">₹{p.price} · stock {p.stock} {!p.is_available && <span className="text-red-500">· hidden</span>}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => startEdit(p)} className="rounded-lg border border-black/10 px-3 py-1 text-sm text-ink hover:bg-black/5">Edit</button>
                  <button onClick={() => remove(p.id)} className="rounded-lg border border-red-200 px-3 py-1 text-sm text-red-500 hover:bg-red-50">Delete</button>
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

function Select({ label, children, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink/70">{label}</label>
      <select {...props} className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30">
        {children}
      </select>
    </div>
  );
}
