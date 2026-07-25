import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useLanguage } from "../i18n/LanguageContext";
import { LANGUAGES } from "../i18n/translations";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { cart, refreshCart } = useCart();
  const { lang, changeLang, t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    refreshCart();
  }, [user, refreshCart]);

  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <header className="sticky top-0 z-40 bg-forest text-cream shadow-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl">🥛</span>
          <span className="font-display text-xl font-semibold tracking-tight">
            Katlkar Dairy
          </span>
        </Link>

        <div className="hidden flex-1 max-w-md mx-6 md:block">
          <SearchBar placeholder={t("searchPlaceholder")} onSearch={(q) => navigate(`/?search=${encodeURIComponent(q)}`)} />
        </div>

        <nav className="flex items-center gap-3 text-sm font-medium">
          <div className="hidden gap-1 sm:flex">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => changeLang(l.code)}
                className={`rounded px-1.5 py-0.5 text-xs font-semibold ${lang === l.code ? "bg-turmeric text-ink" : "text-cream/70 hover:text-cream"}`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <Link to="/cart" className="relative flex items-center gap-1 rounded-full bg-forest-dark px-3 py-1.5 hover:bg-forest-light transition">
            🛒 {t("cart")}
            {itemCount > 0 && (
              <span className="ml-1 rounded-full bg-turmeric px-2 py-0.5 text-xs font-bold text-ink">
                {itemCount}
              </span>
            )}
          </Link>
          {user ? (
            <>
              {user.role === "admin" && (
                <Link to="/admin" className="hover:text-turmeric transition">{t("admin")}</Link>
              )}
              <Link to="/orders" className="hover:text-turmeric transition">{t("orders")}</Link>
              <Link to="/account" className="hover:text-turmeric transition">Account</Link>
              <button onClick={logout} className="hover:text-turmeric transition">{t("logout")}</button>
              <span className="hidden lg:inline text-cream/70">Hi, {user.name.split(" ")[0]}</span>
            </>
          ) : (
            <Link to="/login" className="rounded-full bg-turmeric px-3 py-1.5 font-semibold text-ink hover:bg-turmeric-dark transition">
              {t("login")}
            </Link>
          )}
        </nav>
      </div>
      <div className="block px-4 pb-3 md:hidden">
        <SearchBar placeholder={t("searchPlaceholder")} onSearch={(q) => navigate(`/?search=${encodeURIComponent(q)}`)} />
      </div>
    </header>
  );
}

function SearchBar({ onSearch, placeholder }) {
  const [q, setQ] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(q);
      }}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border-none bg-cream/95 px-4 py-2 text-sm text-ink placeholder:text-ink/50 focus:outline-none focus:ring-2 focus:ring-turmeric"
      />
    </form>
  );
}
