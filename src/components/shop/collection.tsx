import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SlidersHorizontal, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "./primitives";
import { ProductCard } from "./product-card";
import type { Collection, Product } from "@/lib/commerce";
export interface CollectionSearch {
  anlass?: string | undefined;
  groesse?: string | undefined;
  farbe?: string | undefined;
  passform?: string | undefined;
  preis?: number | undefined;
  sort?: "newest" | "price-asc" | "price-desc" | undefined;
}
const groups = [
  {
    key: "groesse",
    label: "Grösse",
    values: ["40", "41", "42", "43", "44", "45", "46", "48", "50", "52", "54", "56"],
  },
  {
    key: "farbe",
    label: "Farbe",
    values: ["Marine", "Anthrazit", "Salbeigrün", "Braun", "Schwarz"],
  },
  { key: "passform", label: "Passform", values: ["Slim Fit", "Regular Fit"] },
  { key: "anlass", label: "Anlass", values: ["hochzeit", "business", "abschlussfeier", "gala"] },
] as const;
const label = (v: string) =>
  v === "Slim Fit"
    ? "Schmale Passform"
    : v === "Regular Fit"
      ? "Gerade Passform"
      : v.charAt(0).toUpperCase() + v.slice(1);
export function CollectionPage({
  collection,
  products,
  search,
}: {
  collection: Collection;
  products: Product[];
  search: CollectionSearch;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const change = (key: keyof CollectionSearch, value: string | number | undefined) => {
    navigate({
      to: "/kollektion/$handle",
      params: { handle: collection.handle },
      search: { ...search, [key]: value },
      replace: true,
    });
  };
  const toggle = (key: "groesse" | "farbe" | "passform" | "anlass", value: string) => {
    const list = search[key]?.split(",") || [];
    change(
      key,
      list.includes(value)
        ? list.filter((v) => v !== value).join(",") || undefined
        : key === "anlass"
          ? value
          : [...list, value].join(","),
    );
  };
  const filters = (
    <>
      {groups.map((g) => (
        <details className="filter-group" key={g.key}>
          <summary>
            {g.label}
            <ChevronDown size={14} />
          </summary>
          <div className="filter-options">
            {g.values.map((v) => (
              <label key={v}>
                <input
                  type="checkbox"
                  checked={Boolean(search[g.key]?.split(",").includes(v))}
                  onChange={() => toggle(g.key, v)}
                />
                {label(v)}
              </label>
            ))}
          </div>
        </details>
      ))}
      <details className="filter-group">
        <summary>
          Preis
          <ChevronDown size={14} />
        </summary>
        <div className="filter-options">
          <label htmlFor="price-filter">Bis CHF {search.preis || 500}</label>
          <input
            id="price-filter"
            type="range"
            min="100"
            max="500"
            step="10"
            value={search.preis || 500}
            onChange={(e) => change("preis", Number(e.target.value))}
          />
        </div>
      </details>
    </>
  );
  const sort = (
    <select
      aria-label="Sortieren"
      value={search.sort || "newest"}
      onChange={(e) => change("sort", e.target.value)}
    >
      <option value="newest">Neuheiten</option>
      <option value="price-asc">Preis aufsteigend</option>
      <option value="price-desc">Preis absteigend</option>
    </select>
  );
  return (
    <div className="container page-body">
      <p className="eyebrow">AXION Kollektion</p>
      <h1 className="page-title">{collection.title}</h1>
      <p className="page-intro">{collection.description}</p>
      <div className="filters-bar">
        <div className="filter-controls desktop-filter-controls">{filters}</div>
        <Button variant="tailored" className="mobile-filters" onClick={() => setOpen(true)}>
          <SlidersHorizontal />
          Filtern und sortieren
        </Button>
        <span className="text-muted text-xs">{products.length} Stücke</span>
        {sort}
      </div>
      <div className="active-filters">
        {Object.entries(search)
          .filter(([key, value]) => key !== "sort" && value)
          .map(([key, value]) => (
            <Button
              variant="icon"
              key={key}
              onClick={() => change(key as keyof CollectionSearch, undefined)}
            >
              {key === "preis" ? `Bis CHF ${value}` : String(value).split(",").map(label).join(",")}
              <X />
            </Button>
          ))}
      </div>
      {products.length ? (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.handle} product={p} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Keine passenden Stücke</h2>
          <p className="text-muted">Versuche eine andere Auswahl.</p>
          <Button
            onClick={() =>
              navigate({
                to: "/kollektion/$handle",
                params: { handle: collection.handle },
                search: {},
                replace: true,
              })
            }
          >
            Filter zurücksetzen
          </Button>
        </div>
      )}
      <Panel open={open} onOpenChange={setOpen} kind="bottom" title="Filtern und sortieren">
        <div className="filter-controls">
          {filters}
          <label>Sortieren {sort}</label>
        </div>
        <Button className="w-full mt-8" onClick={() => setOpen(false)}>
          {products.length} Stücke ansehen
        </Button>
      </Panel>
    </div>
  );
}
