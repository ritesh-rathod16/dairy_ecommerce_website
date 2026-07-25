// Converts a base64url VAPID public key into the Uint8Array format the
// Push API's subscribe() call expects.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Requests notification permission (if not already granted/denied) and
 * subscribes this browser to Web Push, registering the subscription with
 * the given portal's API client. Call this from a real user action (a
 * button click) — browsers require a user gesture before prompting.
 *
 * Returns "subscribed" | "denied" | "unsupported" | "unavailable" (VAPID
 * not configured server-side) | "error".
 */
export async function enablePushNotifications(apiClient) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  // The service worker only registers in production builds (see main.jsx) —
  // in `npm run dev` there's nothing for pushManager.ready to resolve
  // against, and it would hang forever waiting.
  if (!import.meta.env.PROD) {
    return "unsupported";
  }

  try {
    const { data } = await apiClient.get("/push/vapid-public-key");
    if (!data.enabled || !data.public_key) {
      return "unavailable";
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return "denied";
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.public_key),
      });
    }

    const json = subscription.toJSON();
    await apiClient.post("/push/subscribe", {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
    return "subscribed";
  } catch (err) {
    console.error("Push subscription failed:", err);
    return "error";
  }
}

export function pushPermissionStatus() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

let alreadyBeeped = new Set();

/**
 * Plays a short beep for a foreground push notification. Listens for the
 * "push-received" postMessage the service worker sends to open tabs (see
 * public/sw.js). Dedupes by notification tag so the same event never beeps
 * twice — call once, e.g. from your top-level App component.
 */
export function listenForPushSound() {
  if (!("serviceWorker" in navigator)) return () => {};

  const handler = (event) => {
    if (event.data?.type !== "push-received") return;
    const key = event.data.payload?.url || event.data.payload?.title;
    if (key && alreadyBeeped.has(key)) return;
    if (key) alreadyBeeped.add(key);

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio isn't available (autoplay policy, unsupported browser) — non-fatal.
    }
  };

  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}
