import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { messages, toLocale, useLocale, useT } from "@/i18n";
import { pageHead } from "@/lib/commerce/seo";
import { getProductsByHandles, type Product } from "@/lib/commerce";
import { useStoreHydrated } from "@/hooks/use-store-hydrated";
import { useWishlist } from "@/lib/commerce/stores";
import { ProductCard } from "@/components/shop/product-card";
import { EmptyState } from "@/components/shop/cart";
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
  const handles = useWishlist((s) => s.handles);
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    if (!hydrated) return;
    setLoaded(false);
    let live = true;
    getProductsByHandles(handles, locale).then((p) => {
      if (live) {
        setProducts(p);
        setLoaded(true);
      }
    });
    return () => {
      live = false;
    };
  }, [handles, hydrated, locale]);
  return (
    <div className="container page-body">
      <p className="eyebrow">{t.wishlist.eyebrow}</p>
      <h1 className="page-title">{t.wishlist.title}</h1>
      {!hydrated || !loaded ? (
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
