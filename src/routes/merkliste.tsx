import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { pageHead } from "@/lib/commerce/seo";
import { getProductsByHandles, type Product } from "@/lib/commerce";
import { useStoreHydrated } from "@/hooks/use-store-hydrated";
import { useWishlist } from "@/lib/commerce/stores";
import { ProductCard } from "@/components/shop/product-card";
import { EmptyState } from "@/components/shop/cart";
export const Route = createFileRoute("/merkliste")({
  head: () =>
    pageHead(
      "Deine Merkliste",
      "Bewahre deine liebsten Anzüge, Westen und Schuhe von Axion in deiner Merkliste auf.", "/merkliste"),
  component: Wishlist,
});
function Wishlist() {
  const hydrated = useStoreHydrated(useWishlist.persist);
  const [loaded, setLoaded] = useState(false);
  const handles = useWishlist((s) => s.handles);
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    if (!hydrated) return;
    setLoaded(false);
    let live = true;
    getProductsByHandles(handles).then((p) => {
      if (live) { setProducts(p); setLoaded(true); }
    });
    return () => {
      live = false;
    };
  }, [handles, hydrated]);
  return (
    <div className="container page-body">
      <p className="eyebrow">Für später behalten</p>
      <h1 className="page-title">Deine Merkliste</h1>
      {!hydrated || !loaded ? <p className="text-muted" role="status">Merkliste wird geladen …</p> : products.length ? (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.handle} product={p} />
          ))}
        </div>
      ) : (
        <EmptyState title="Noch keine Stücke gemerkt" text="Bewahre hier auf, was dir gefällt." />
      )}
    </div>
  );
}
