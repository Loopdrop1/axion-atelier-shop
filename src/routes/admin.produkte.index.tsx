// Produkte: Liste mit Status, Preis und Bestand; neues Produkt anlegen.
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listProducts, type ProductListRow } from "@/lib/admin/api";
import { imageUrl } from "@/lib/commerce/mapping";
import { Badge, chf, ErrorBox, Loading, PageHeader, PRODUCT_STATUS } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/produkte/")({
  component: Products,
});

function thumb(p: ProductListRow) {
  const first = [...p.product_images].sort((a, b) => a.sort - b.sort)[0];
  return imageUrl(first?.path, "product-images");
}

function Products() {
  const query = useQuery({ queryKey: ["admin", "products"], queryFn: listProducts });
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "draft" | "archived">("all");
  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (query.data ?? []).filter(
      (p) =>
        (status === "all" || p.status === status) &&
        (!t ||
          [p.title_de, p.title_en, p.handle, p.color_name_de].some((v) =>
            v?.toLowerCase().includes(t),
          )),
    );
  }, [query.data, term, status]);

  return (
    <>
      <PageHeader
        title="Produkte"
        description="Ein Produkt ist eine Farbe eines Modells. Gleiches Modell in anderen Farben erscheint als Farbauswahl."
        actions={
          <Button variant="admin" asChild>
            <Link to="/admin/produkte/$id" params={{ id: "neu" }}>
              <Plus /> Neues Produkt
            </Link>
          </Button>
        }
      />
      <div className="admin-toolbar">
        <nav className="admin-tabs" aria-label="Status">
          {(["all", "active", "draft", "archived"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={status === s ? "active" : ""}
              onClick={() => setStatus(s)}
            >
              {s === "all" ? "Alle" : PRODUCT_STATUS[s].label}
            </button>
          ))}
        </nav>
        <div className="admin-search">
          <Input
            type="search"
            placeholder="Titel, Farbe oder Adresse"
            aria-label="Produkte suchen"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorBox error={query.error} onRetry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <p className="admin-empty">Keine Produkte gefunden.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-table-click">
            <thead>
              <tr>
                <th>Produkt</th>
                <th className="admin-hide-sm">Kategorie</th>
                <th>Status</th>
                <th className="num">Preis</th>
                <th className="num">Bestand</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const src = thumb(p);
                const stock = p.product_variants
                  .filter((v) => v.active)
                  .reduce((n, v) => n + v.stock, 0);
                const s = PRODUCT_STATUS[p.status];
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="admin-item">
                        {src ? (
                          <img src={src} alt="" width={40} height={50} />
                        ) : (
                          <span className="admin-thumb" />
                        )}
                        <div>
                          <Link
                            to="/admin/produkte/$id"
                            params={{ id: p.id }}
                            className="admin-link"
                          >
                            {p.title_de}
                          </Link>
                          <span className="admin-sub">
                            {p.color_name_de} · /{p.handle}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="admin-hide-sm">{p.category?.name_de ?? "–"}</td>
                    <td>
                      <Badge tone={s.tone}>{s.label}</Badge>
                      {p.tags.includes("neu") && <Badge>Neu</Badge>}
                      {p.tags.includes("sale") && <Badge>Sale</Badge>}
                    </td>
                    <td className="num">
                      {chf(p.price_cents)}
                      {p.compare_at_cents && (
                        <span className="admin-sub admin-strike">{chf(p.compare_at_cents)}</span>
                      )}
                    </td>
                    <td className="num">
                      {stock === 0 ? <Badge tone="danger">0</Badge> : stock}
                      <span className="admin-sub">
                        {p.product_variants.filter((v) => v.active).length} Grössen
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
