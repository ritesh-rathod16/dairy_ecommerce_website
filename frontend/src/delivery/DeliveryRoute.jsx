import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useDeliveryAuth } from "./DeliveryAuthContext";

export default function DeliveryRoute({ children }) {
  const { user, loading } = useDeliveryAuth();
  const location = useLocation();

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-forest">Loading...</div>;
  }
  if (!user || user.role !== "delivery_partner") {
    return <Navigate to="/delivery/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}
