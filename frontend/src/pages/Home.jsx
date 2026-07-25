import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import client from "../api/client";
import ProductCard from "../components/ProductCard";
import { useLanguage } from "../i18n/LanguageContext";

export default function Home() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") || "";
  const activeCategory = searchParams.get("category") || "";

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get("/categories").then((res) => setCategories(res.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (activeCategory) params.category = activeCategory;
    client
      .get("/products", { params })
      .then((res) => setProducts(res.data.items))
      .finally(() => setLoading(false));
  }, [search, activeCategory]);

  const setCategory = (slug) => {
    const next = new URLSearchParams(searchParams);
    if (slug) next.set("category", slug);
    else next.delete("category");
    setSearchParams(next);
  };

  return (
    <div>
      <section className="bg-forest text-cream">
        <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-turmeric">
            {t("tagline")}
          </p>
          <h1 className="max-w-xl font-display text-3xl font-semibold leading-tight md:text-4xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-3 max-w-lg text-cream/80">
            {t("heroSubtitle")}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex gap-3 overflow-x-auto pb-2">
          <CategoryChip label={t("all")} active={!activeCategory} onClick={() => setCategory("")} />
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              label={`${c.icon || ""} ${c.name}`}
              active={activeCategory === c.slug}
              onClick={() => setCategory(c.slug)}
            />
          ))}
        </div>

        {search && (
          <p className="mt-4 text-sm text-ink/60">
            Showing results for <span className="font-semibold">&ldquo;{search}&rdquo;</span>
          </p>
        )}

        {loading ? (
          <div className="py-16 text-center text-forest">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center text-ink/60">No products found. Try a different search.</div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CategoryChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-forest bg-forest text-cream"
          : "border-forest/20 bg-white text-ink hover:border-forest/50"
      }`}
    >
      {label}
    </button>
  );
}
