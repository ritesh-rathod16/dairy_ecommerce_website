import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "./AdminAuthContext";

export default function AdminRoute({ children }) {
  const { user, loading } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-forest">Loading...</div>;
  }
  if (!user || user.role !== "admin") {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}
