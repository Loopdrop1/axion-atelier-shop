// Produkt bearbeiten oder neu anlegen (/admin/produkte/neu). Grössen und Bilder nach dem ersten Speichern.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  deleteProduct,
  getProduct,
  listCategories,
  listProducts,
  saveProduct,
} from "@/lib/admin/api";
import type { AutoTranslateResult } from "@/lib/admin/auto-translate";
import { invalidateCatalog } from "@/lib/commerce/source";
import { ImageManager } from "@/components/admin/image-manager";
import { ProductForm, type ProductValues } from "@/components/admin/product-form";
import { VariantTable } from "@/components/admin/variant-table";
import {
  Badge,
  ConfirmButton,
  ErrorBox,
  Loading,
  notify,
  PageHeader,
  Panel,
  PRODUCT_STATUS,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/produkte/$id")({
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const isNew = id === "neu";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const product = useQuery({
    queryKey: ["admin", "product", id],
    queryFn: () => getProduct(id),
    enabled: !isNew,
  });
  const categories = useQuery({ queryKey: ["admin", "categories"], queryFn: listCategories });
  const products = useQuery({ queryKey: ["admin", "products"], queryFn: listProducts });

  const refresh = () => {
    invalidateCatalog();
    void queryClient.invalidateQueries({ queryKey: ["admin", "product", id] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "stock"] });
  };

  async function save(values: ProductValues, translation: AutoTranslateResult) {
    try {
      const saved = await saveProduct(isNew ? values : { ...values, id });
      notify.saved(
        isNew ? "Produkt angelegt. Jetzt Grössen und Bilder ergänzen." : "Gespeichert.",
        translation,
      );
      refresh();
      if (isNew)
        void navigate({ to: "/admin/produkte/$id", params: { id: saved.id }, replace: true });
    } catch (error) {
      notify.error(error);
      throw error;
    }
  }

  const back = (
    <Link to="/admin/produkte" className="admin-back">
      <ArrowLeft aria-hidden="true" /> Alle Produkte
    </Link>
  );

  if ((!isNew && product.isLoading) || categories.isLoading || products.isLoading)
    return <Loading />;
  if (product.isError || categories.isError || products.isError)
    return <ErrorBox error={product.error ?? categories.error ?? products.error} />;
  if (!isNew && !product.data)
    return (
      <>
        {back}
        <p className="admin-empty">Dieses Produkt gibt es nicht.</p>
      </>
    );
  if (!categories.data?.length)
    return (
      <>
        {back}
        <p className="admin-empty">
          Zuerst eine <Link to="/admin/kategorien">Kategorie</Link> anlegen.
        </p>
      </>
    );

  const p = product.data ?? null;
  const status = p ? PRODUCT_STATUS[p.status] : null;
  return (
    <>
      {back}
      <PageHeader
        title={p ? `${p.title_de} · ${p.color_name_de}` : "Neues Produkt"}
        description={
          p && status ? (
            <>
              <Badge tone={status.tone}>{status.label}</Badge>{" "}
              {p.status === "active" && (
                <a
                  className="admin-link"
                  href={`/produkt/${p.handle}`}
                  target="_blank"
                  rel="noopener"
                >
                  Im Shop ansehen <ExternalLink aria-hidden="true" className="admin-inline-icon" />
                </a>
              )}
            </>
          ) : (
            "Zuerst die Grunddaten speichern, danach Grössen, Bestand und Bilder ergänzen."
          )
        }
      />
      <ProductForm
        key={p?.updated_at ?? "neu"}
        product={p}
        categories={categories.data}
        products={products.data ?? []}
        onSave={save}
      />
      {p && (
        <>
          <VariantTable
            productId={p.id}
            productLabel={`${p.title_de} · ${p.color_name_de}`}
            variants={p.product_variants}
            onChange={refresh}
          />
          <ImageManager product={p} images={p.product_images} onChange={refresh} />
          <Panel
            title="Produkt entfernen"
            description="Besser archivieren (Status «Archiviert»): Das Produkt verschwindet aus dem Shop, bleibt aber für Auswertungen erhalten."
          >
            <ConfirmButton
              label="Produkt löschen"
              variant="outline"
              title={`«${p.title_de}» endgültig löschen?`}
              description="Grössen, Bestand, Lagerbewegungen und Bilder dieses Produkts werden gelöscht. Bestellungen behalten ihre Angaben."
              confirmLabel="Endgültig löschen"
              onConfirm={async () => {
                await deleteProduct(
                  p.id,
                  p.product_images.map((i) => i.path).filter((path) => !path.startsWith("asset:")),
                );
                notify.ok("Produkt gelöscht.");
                invalidateCatalog();
                void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
                void navigate({ to: "/admin/produkte" });
              }}
            />
          </Panel>
        </>
      )}
    </>
  );
}
