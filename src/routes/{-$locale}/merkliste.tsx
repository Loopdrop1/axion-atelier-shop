import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { messages, toLocale, useLocale, useT } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { getProductsByHandles, type Product } from "@/lib/commerce";
import { useStoreHydrated } from "@/hooks/use-store-hydrated";
import { useWishlist } from "@/lib/commerce/stores";
import { ProductCard } from "@/components/shop/product-card";
import { EmptyState } from "@/components/shop/cart";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/{-$locale}/merkliste")({
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const t = messages[locale].wishlist;
    return pageHead(t.title, t.description, "/merkliste", locale, { noindex: true });
  },
  component: Wishlist,
});
function Wishlist() {
  const t = useT();
  const locale = useLocale();
  const hydrated = useStoreHydrated(useWishlist.persist);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const handles = useWishlist((s) => s.handles);
  const prune = useWishlist((s) => s.prune);
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    if (!hydrated) return;
    let live = true;
    setFailed(false);
    getProductsByHandles(handles, locale)
      .then((p) => {
        if (live) {
          setProducts(p);
          setLoaded(true);
          // Handles, die es nicht mehr gibt (gelöscht, deaktiviert), aus der Merkliste räumen: der Zähler stimmt dann
          if (p.length < handles.length) prune(p.map((x) => x.handle));
        }
      })
      // Katalog nicht erreichbar: Hinweis mit «Erneut versuchen» statt endlosem «Lädt …» (wie der Warenkorb)
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [handles, hydrated, locale, prune, attempt]);
  return (
    <div className="container page-body">
      <p className="eyebrow">{t.wishlist.eyebrow}</p>
      <h1 className="page-title">{t.wishlist.title}</h1>
      {failed ? (
        <div className="cart-error" role="alert">
          <p>{t.common.error}</p>
          <Button variant="tailored" onClick={() => setAttempt((n) => n + 1)}>
            {t.common.retry}
          </Button>
        </div>
      ) : !hydrated || !loaded ? (
        <p className="text-muted" role="status">
          {t.wishlist.loading}
        </p>
      ) : products.length ? (
        <div className="product-grid wishlist-grid">
          {products.map((p) => (
            <ProductCard key={p.handle} product={p} />
          ))}
        </div>
      ) : (
        <EmptyState title={t.wishlist.emptyTitle} text={t.wishlist.emptyText} suggest />
      )}
    </div>
  );
}
