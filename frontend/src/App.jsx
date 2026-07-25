import React, { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { listenForPushSound } from "./utils/push";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Account from "./pages/Account";
import AdminRoute from "./admin/AdminRoute";
import AdminLogin from "./admin/AdminLogin";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/pages/AdminDashboard";
import AdminProducts from "./admin/pages/AdminProducts";
import AdminCategories from "./admin/pages/AdminCategories";
import AdminOrders from "./admin/pages/AdminOrders";
import AdminDeliveryPartners from "./admin/pages/AdminDeliveryPartners";
import AdminEmployees from "./admin/pages/AdminEmployees";
import AdminAnalytics from "./admin/pages/AdminAnalytics";
import AdminSettings from "./admin/pages/AdminSettings";
import AdminDangerZone from "./admin/pages/AdminDangerZone";
import AdminLiveTracking from "./admin/pages/AdminLiveTracking";
import DeliveryRoute from "./delivery/DeliveryRoute";
import DeliveryLogin from "./delivery/DeliveryLogin";
import DeliveryDashboard from "./delivery/DeliveryDashboard";
import DeliveryHistory from "./delivery/DeliveryHistory";

export default function App() {
  const location = useLocation();

  useEffect(() => listenForPushSound(), []);

  // The admin panel and delivery-partner app have their own layouts/chrome —
  // neither uses the customer navbar or footer.
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isDeliveryRoute = location.pathname.startsWith("/delivery");
  const hideCustomerChrome = isAdminRoute || isDeliveryRoute;

  return (
    <div className="min-h-screen bg-cream font-body">
      {!hideCustomerChrome && <Navbar />}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/checkout"
            element={
              <ProtectedRoute>
                <Checkout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:orderId"
            element={
              <ProtectedRoute>
                <OrderDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            }
          />

          {/* Admin login is public — anyone can reach the form, but only an
              account with role "admin" can actually sign in successfully. */}
          <Route path="/admin/login" element={<AdminLogin />} />

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="delivery-partners" element={<AdminDeliveryPartners />} />
            <Route path="employees" element={<AdminEmployees />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="danger-zone" element={<AdminDangerZone />} />
            <Route path="live-tracking" element={<AdminLiveTracking />} />
          </Route>

          {/* Delivery partner app — separate login, own dashboard, no customer chrome. */}
          <Route path="/delivery/login" element={<DeliveryLogin />} />
          <Route
            path="/delivery"
            element={
              <DeliveryRoute>
                <DeliveryDashboard />
              </DeliveryRoute>
            }
          />
          <Route
            path="/delivery/history"
            element={
              <DeliveryRoute>
                <DeliveryHistory />
              </DeliveryRoute>
            }
          />
        </Routes>
      </main>
      {!hideCustomerChrome && (
        <footer className="mt-16 border-t border-forest/10 bg-white py-8 text-center text-sm text-ink/50">
          🥛 Katlkar Dairy — fresh dairy for your town, delivered daily.
        </footer>
      )}
    </div>
  );
}
