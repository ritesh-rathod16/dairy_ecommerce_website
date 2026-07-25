import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { adminApi } from "../adminApi";

const ACTIONS = [
  { key: "delete-orders", label: "Delete all Orders", desc: "Permanently removes every order record." },
  { key: "delete-products", label: "Delete all Products", desc: "Permanently removes your entire product catalog." },
  { key: "delete-categories", label: "Delete all Categories", desc: "Removes all categories. Products keep existing, just become uncategorized." },
  { key: "delete-customers", label: "Delete all Customers", desc: "Removes every customer account and their carts (admin accounts are kept)." },
  { key: "delete-everything", label: "Delete Everything", desc: "Wipes orders, products, categories, customers, and carts. Admin accounts are preserved so you don't lock yourself out." },
];

export default function AdminDangerZone() {
  const [activeAction, setActiveAction] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const openConfirm = async (action) => {
    setActiveAction(action);
    setConfirmText("");
    setResult(null);
    setError("");
    setPreview(null);
    setLoadingPreview(true);
    try {
      setPreview(await adminApi.dangerPreview(action.key));
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load a preview of what this will affect.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const run = async () => {
    if (confirmText !== "DELETE") return;
    setRunning(true);
    setError("");
    try {
      const res = await adminApi.dangerDelete(activeAction.key, confirmText);
      setResult(res);
      setActiveAction(null);
    } catch (err) {
      setError(err.response?.data?.detail || "Action failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2">
        <AlertTriangle size={22} className="text-red-500" />
        <h1 className="text-2xl font-semibold text-ink">Danger Zone</h1>
      </div>
      <p className="mt-1 text-sm text-ink/50">
        These actions are irreversible. There is no undo — make sure you have an export/backup first.
      </p>

      {result && (
        <div className="mt-4 rounded-lg bg-forest/10 px-4 py-3 text-sm font-medium text-forest">
          Done: {JSON.stringify(result)}
        </div>
      )}

      <div className="mt-4 space-y-3 rounded-xl border-2 border-red-200 bg-red-50/40 p-5">
        {ACTIONS.map((a) => (
          <div key={a.key} className="flex items-center justify-between gap-4 rounded-lg bg-white p-4 shadow-sm">
            <div>
              <p className="font-medium text-ink">{a.label}</p>
              <p className="text-sm text-ink/50">{a.desc}</p>
            </div>
            <button
              onClick={() => openConfirm(a)}
              className="shrink-0 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {activeAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="font-semibold text-ink">{activeAction.label}?</h2>

            {loadingPreview ? (
              <p className="mt-3 text-sm text-ink/50">Checking what this will affect...</p>
            ) : preview ? (
              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <p className="font-medium text-red-600">This will delete:</p>
                  <ul className="mt-1 list-inside list-disc text-ink/80">
                    {Object.entries(preview.will_delete || {}).map(([label, count]) => (
                      <li key={label}>{count} {label}</li>
                    ))}
                  </ul>
                </div>
                {preview.will_modify && (
                  <div>
                    <p className="font-medium text-turmeric-dark">This will modify (not delete):</p>
                    <ul className="mt-1 list-inside list-disc text-ink/80">
                      {Object.entries(preview.will_modify).map(([label, count]) => (
                        <li key={label}>{count} {label}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {preview.will_not_touch?.length > 0 && (
                  <div>
                    <p className="font-medium text-forest">This will NOT touch:</p>
                    <p className="text-ink/60">{preview.will_not_touch.join(", ")}</p>
                  </div>
                )}
              </div>
            ) : null}

            <p className="mt-3 text-sm text-ink/70">
              Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm:
            </p>
            <input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            {error && <p className="mt-2 text-sm font-medium text-red-500">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={run}
                disabled={confirmText !== "DELETE" || running}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                {running ? "Deleting..." : "Confirm delete"}
              </button>
              <button
                onClick={() => setActiveAction(null)}
                className="rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
