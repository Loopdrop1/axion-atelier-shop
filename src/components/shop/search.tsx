import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { searchProducts, type Product } from "@/lib/commerce";
import { useShopUI } from "@/lib/commerce/stores";
import { formatPrice } from "@/lib/commerce/format";
import { Photo, Panel } from "./primitives";
export function SearchOverlay() {
  const { searchOpen, setSearch } = useShopUI();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  useEffect(() => {
    let live = true;
    searchProducts(query).then((p) => {
      if (live) setResults(p);
    });
    return () => {
      live = false;
    };
  }, [query]);
  return (
    <Panel open={searchOpen} onOpenChange={setSearch} title="Was suchst du?" kind="search">
      <input
        aria-label="Produkte suchen"
        placeholder="Anzüge, Westen, Schuhe …"
        className="search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            refs.current[0]?.focus();
          }
        }}
      />
      <div className="search-results">
        {results.slice(0, 5).map((p, i) => (
          <Link
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="search-result"
            key={p.handle}
            to="/produkt/$handle"
            params={{ handle: p.handle }}
            onClick={() => setSearch(false)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                refs.current[Math.min(i + 1, results.length - 1)]?.focus();
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                refs.current[Math.max(i - 1, 0)]?.focus();
              }
            }}
          >
            <Photo image={p.images[0]} />
            <div>
              <h3>{p.title}</h3>
              <p>{p.color.name}</p>
            </div>
            <span className="price">{formatPrice(p.priceRange.min)}</span>
          </Link>
        ))}
      </div>
      {query && !results.length && <p className="text-muted">Keine passenden Stücke gefunden.</p>}
      {query && (
        <Link
          className="text-link"
          to="/suche"
          search={{ q: query }}
          onClick={() => setSearch(false)}
        >
          Alle Ergebnisse <ArrowRight />
        </Link>
      )}
    </Panel>
  );
}
