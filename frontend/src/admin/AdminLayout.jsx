import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Package, Tags, ClipboardList, Truck,
  Settings, LogOut, Search, BarChart3, DatabaseZap, Bell, Users, MapPin,
} from "lucide-react";
import { useAdminAuth } from "./AdminAuthContext";
import adminClient from "../api/adminClient";
import { enablePushNotifications, pushPermissionStatus } from "../utils/push";

const LINKS = [
  { to: "/admin", label: "Dashboard", end: true, icon: LayoutDashboard },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/delivery-partners", label: "Delivery Partners", icon: Truck },
  { to: "/admin/live-tracking", label: "Live Tracking", icon: MapPin },
  { to: "/admin/employees", label: "Employees", icon: Users },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/danger-zone", label: "Danger Zone", icon: DatabaseZap },
];

export default function AdminLayout() {
  const { user, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [pushStatus, setPushStatus] = useState(pushPermissionStatus());

  const handleEnablePush = async () => {
    const result = await enablePushNotifications(adminClient);
    if (result === "subscribed") setPushStatus("granted");
    else if (result === "denied") setPushStatus("denied");
    else if (result === "unavailable") alert("Push notifications aren't configured on this server yet.");
    else if (result === "unsupported") alert("Push notifications need a production build (npm run build) — they're disabled in dev mode.");
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const q = e.target.elements.q.value.trim();
    if (q) navigate(`/admin/orders?search=${encodeURIComponent(q)}`);
  };

  return (
    <div className="flex min-h-screen bg-[#F5F6F8]">
      {/* Fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 w-60 shrink-0 bg-ink text-cream/80">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="text-2xl">🥛</span>
          <div>
            <p className="font-display text-sm font-semibold text-cream leading-tight">Katlkar Dairy</p>
            <p className="text-[11px] uppercase tracking-wide text-cream/40">Admin</p>
          </div>
        </div>

        <nav className="mt-2 space-y-0.5 px-3">
          {LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? "bg-forest text-cream" : "text-cream/60 hover:bg-white/5 hover:text-cream"
                  }`
                }
              >
                <Icon size={17} strokeWidth={2} />
                {l.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full border-t border-white/10 px-3 py-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-cream/60 hover:bg-white/5 hover:text-cream transition"
          >
            <LogOut size={17} strokeWidth={2} />
            Log out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col pl-60">
        {/* Sticky topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-black/5 bg-white px-6">
          <form onSubmit={handleSearch} className="w-full max-w-sm">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
              <input
                name="q"
                placeholder="Search orders by number..."
                className="w-full rounded-lg border border-black/10 bg-[#F5F6F8] py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
              />
            </div>
          </form>

          <div className="flex items-center gap-3">
            {pushStatus !== "granted" && (
              <button
                onClick={handleEnablePush}
                title="Enable browser notifications for new orders"
                className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium text-ink hover:bg-black/5"
              >
                <Bell size={15} /> Enable notifications
              </button>
            )}
            {pushStatus === "granted" && (
              <span className="flex items-center gap-1.5 text-xs text-forest">
                <Bell size={14} /> Notifications on
              </span>
            )}
            <div className="text-right">
              <p className="text-sm font-medium text-ink leading-tight">{user?.name}</p>
              <p className="text-xs text-ink/40 leading-tight">{user?.email}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-forest text-sm font-semibold text-cream">
              {user?.name?.[0]?.toUpperCase() || "A"}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
