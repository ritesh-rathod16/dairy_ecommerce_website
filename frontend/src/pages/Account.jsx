import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import ChangePasswordForm from "../components/ChangePasswordForm";
import { enablePushNotifications, pushPermissionStatus } from "../utils/push";

export default function Account() {
  const { user } = useAuth();
  const [pushStatus, setPushStatus] = useState(pushPermissionStatus());
  const [pushMessage, setPushMessage] = useState("");

  if (!user) return null;

  const handleEnablePush = async () => {
    setPushMessage("");
    const result = await enablePushNotifications(client);
    if (result === "subscribed") {
      setPushStatus("granted");
      setPushMessage("Notifications enabled — you'll get updates on your order status.");
    } else if (result === "denied") {
      setPushStatus("denied");
      setPushMessage("Notifications were blocked. You can re-enable them in your browser's site settings.");
    } else if (result === "unavailable") {
      setPushMessage("Notifications aren't configured on this server yet.");
    } else if (result === "unsupported") {
      setPushMessage("Notifications need a production build of the app — they're off in dev mode.");
    } else {
      setPushMessage("Something went wrong enabling notifications.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold text-ink">My Account</h1>

      <div className="mt-4 rounded-xl2 bg-white p-5 shadow-sm">
        <h2 className="font-display font-semibold text-ink">Profile</h2>
        <div className="mt-3 space-y-1 text-sm">
          <p><span className="text-ink/50">Name:</span> <span className="text-ink">{user.name}</span></p>
          <p><span className="text-ink/50">Email:</span> <span className="text-ink">{user.email}</span></p>
          <p><span className="text-ink/50">Phone:</span> <span className="text-ink">{user.phone}</span></p>
        </div>
      </div>

      <div className="mt-4 rounded-xl2 bg-white p-5 shadow-sm">
        <h2 className="font-display font-semibold text-ink">Order notifications</h2>
        <p className="mt-1 text-sm text-ink/60">
          Get a browser notification when your order is confirmed, packed, out for delivery, and delivered.
        </p>
        {pushStatus === "granted" ? (
          <p className="mt-3 text-sm font-medium text-forest">✓ Notifications are on</p>
        ) : (
          <button onClick={handleEnablePush} className="mt-3 rounded-full bg-forest px-5 py-2 text-sm font-semibold text-cream hover:bg-forest-light">
            Enable notifications
          </button>
        )}
        {pushMessage && <p className="mt-2 text-sm text-ink/60">{pushMessage}</p>}
      </div>

      {user.addresses?.length > 0 && (
        <div className="mt-4 rounded-xl2 bg-white p-5 shadow-sm">
          <h2 className="font-display font-semibold text-ink">Saved addresses</h2>
          <div className="mt-3 space-y-3">
            {user.addresses.map((a, i) => (
              <div key={i} className="rounded-lg border border-forest/10 p-3 text-sm">
                <p className="font-medium text-ink">{a.label}</p>
                <p className="text-ink/60">
                  {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city} - {a.pincode}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl2 bg-white p-5 shadow-sm">
        <h2 className="font-display font-semibold text-ink">Change password</h2>
        <div className="mt-3">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
