import React, { useEffect, useState } from "react";
import client from "../api/client";

const STATUS_COPY = {
  pending_verification: {
    tone: "bg-turmeric/20 text-ink",
    text: "Payment reported — we'll confirm it shortly once we verify it on our end.",
  },
  paid: {
    tone: "bg-forest/10 text-forest",
    text: "Payment received. Thank you!",
  },
};

export default function PaymentSection({ order, onPaid }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [qrUrl, setQrUrl] = useState(null);

  const needsPayment = order.payment_method === "ONLINE" && order.payment_status !== "paid";

  useEffect(() => {
    if (!needsPayment) return;
    let objectUrl;
    // The QR image needs the auth header, so we fetch it as a blob via the
    // authenticated axios client rather than using a plain <img src="...">.
    client.get(`/payment/upi-qr/${order.id}`, { responseType: "blob" }).then((res) => {
      objectUrl = URL.createObjectURL(res.data);
      setQrUrl(objectUrl);
    });
    return () => objectUrl && URL.revokeObjectURL(objectUrl);
  }, [needsPayment, order.id]);

  if (order.payment_method !== "ONLINE") {
    return null;
  }

  const statusInfo = STATUS_COPY[order.payment_status];

  const reportPaid = async () => {
    setBusy(true);
    setError("");
    try {
      await client.post(`/payment/report-paid/${order.id}`);
      onPaid();
    } catch {
      setError("Could not report payment. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl2 bg-white p-4 shadow-sm">
      <h3 className="font-display font-semibold text-ink">Complete your payment</h3>

      {order.payment_status === "paid" ? (
        <p className="mt-2 rounded-lg bg-forest/10 px-3 py-2 text-sm font-medium text-forest">
          {STATUS_COPY.paid.text}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink/60">
            Scan with any UPI app (GPay, PhonePe, Paytm, BHIM...) to pay ₹{order.total}.
          </p>

          <div className="mt-3 flex flex-col items-center gap-2 rounded-lg border border-forest/20 bg-cream/40 p-4">
            {qrUrl ? (
              <img src={qrUrl} alt="UPI payment QR code" className="h-48 w-48 rounded-lg bg-white p-2" />
            ) : (
              <div className="flex h-48 w-48 items-center justify-center text-sm text-ink/40">Loading QR...</div>
            )}
            <p className="text-xs text-ink/50">Amount: ₹{order.total} · Ref: #{order.order_number}</p>
          </div>

          {statusInfo && (
            <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${statusInfo.tone}`}>
              {statusInfo.text}
            </p>
          )}

          {order.payment_status !== "pending_verification" && (
            <button
              onClick={reportPaid}
              disabled={busy}
              className="mt-3 w-full rounded-full bg-turmeric px-6 py-3 font-semibold text-ink hover:bg-turmeric-dark disabled:opacity-50"
            >
              {busy ? "Reporting..." : "I've completed the payment"}
            </button>
          )}

          {error && <p className="mt-2 text-sm font-medium text-red-500">{error}</p>}
        </>
      )}
    </div>
  );
}
