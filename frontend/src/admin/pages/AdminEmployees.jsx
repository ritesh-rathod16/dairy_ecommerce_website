import React, { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { adminApi } from "../adminApi";

const ROLES = ["manager", "warehouse", "support"];
const ROLE_LABEL = { manager: "Manager", warehouse: "Warehouse", support: "Support" };

const EMPTY_FORM = { name: "", email: "", phone: "", password: "", role: "manager", notes: "" };

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      setEmployees(await adminApi.listEmployees(roleFilter || undefined, search || undefined));
    } catch (err) {
      setLoadError(err.response?.data?.detail || "Could not load employees.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, search]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const startEdit = (emp) => {
    setEditingId(emp.id);
    setForm({ name: emp.name, email: emp.email, phone: emp.phone, password: "", role: emp.role, notes: emp.notes || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editingId) {
        await adminApi.updateEmployee(editingId, { name: form.name, phone: form.phone, role: form.role, notes: form.notes });
      } else {
        await adminApi.createEmployee(form);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save employee.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (emp) => {
    await adminApi.updateEmployeeStatus(emp.id, emp.status === "active" ? "suspended" : "active");
    load();
  };

  const remove = async (id) => {
    if (!confirm("Remove this employee?")) return;
    await adminApi.deleteEmployee(id);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Employees</h1>
      <p className="mt-1 text-sm text-ink/50">Manager, Warehouse, and Support staff accounts.</p>

      <form onSubmit={submit} className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-black/5 bg-white p-5 shadow-sm md:grid-cols-3">
        <Field label="Name" value={form.name} onChange={update("name")} required />
        <Field label="Email" type="email" value={form.email} onChange={update("email")} required disabled={!!editingId} />
        <Field label="Phone" value={form.phone} onChange={update("phone")} required />
        {!editingId && <Field label="Password" type="password" value={form.password} onChange={update("password")} required minLength={6} />}
        <Select label="Role" value={form.role} onChange={update("role")} required>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </Select>
        <Field label="Notes (optional)" value={form.notes} onChange={update("notes")} />

        {error && <p className="col-span-full text-sm font-medium text-red-500">{error}</p>}

        <div className="col-span-full flex gap-2">
          <button type="submit" disabled={saving}
            className="rounded-lg bg-forest px-5 py-2 text-sm font-semibold text-cream hover:bg-forest-light disabled:opacity-50">
            {saving ? "Saving..." : editingId ? "Update employee" : "Add employee"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-lg border border-black/10 px-5 py-2 text-sm font-semibold text-ink">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="mt-4 flex gap-2">
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm">
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="rounded-lg border border-black/10 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="mt-4 rounded-xl border border-black/5 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-black/5" />)}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <p className="text-sm font-medium text-red-500">{loadError}</p>
            <button onClick={load} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm">Retry</button>
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-ink/40">
            <Users size={28} />
            <p className="text-sm">No employees yet — add one above.</p>
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {employees.map((emp) => (
              <div key={emp.id} className="flex items-center justify-between gap-4 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {emp.name} <span className="badge ml-1 bg-forest/10 text-forest">{ROLE_LABEL[emp.role]}</span>
                    {emp.status === "suspended" && <span className="badge ml-1 bg-red-100 text-red-600">Suspended</span>}
                  </p>
                  <p className="text-sm text-ink/60">{emp.email} · {emp.phone}</p>
                  {emp.notes && <p className="text-xs text-ink/40">{emp.notes}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => startEdit(emp)} className="rounded-lg border border-black/10 px-3 py-1 text-sm text-ink hover:bg-black/5">Edit</button>
                  <button onClick={() => toggleStatus(emp)} className="rounded-lg border border-black/10 px-3 py-1 text-sm text-ink hover:bg-black/5">
                    {emp.status === "active" ? "Suspend" : "Activate"}
                  </button>
                  <button onClick={() => remove(emp.id)} className="rounded-lg border border-red-200 px-3 py-1 text-sm text-red-500 hover:bg-red-50">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-ink/40">
        Note: Manager/Warehouse/Support accounts can be created and managed here, but don't have
        dedicated portals yet — only Admin and Delivery Partner have their own login/dashboard today.
      </p>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink/70">{label}</label>
      <input {...props} className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30 disabled:bg-black/5" />
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
