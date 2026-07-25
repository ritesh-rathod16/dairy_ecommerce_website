import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { LanguageProvider } from "./i18n/LanguageContext.jsx";
import { AdminAuthProvider } from "./admin/AdminAuthContext.jsx";
import { DeliveryAuthProvider } from "./delivery/DeliveryAuthContext.jsx";
import "./index.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal — the app works fine without offline support.
    });
  });
}

// All three portals' auth providers are mounted simultaneously and
// independently (separate localStorage keys, separate API clients) so an
// admin session and a delivery session stay logged in at the same time,
// even across separate browser tabs on the same origin.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <AdminAuthProvider>
            <DeliveryAuthProvider>
              <CartProvider>
                <App />
              </CartProvider>
            </DeliveryAuthProvider>
          </AdminAuthProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
