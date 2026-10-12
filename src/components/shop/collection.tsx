import { useId, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as Popover from "@radix-ui/react-popover";
import { SlidersHorizontal, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "./primitives";
import { ProductCard, useFitLabel } from "./product-card";
import { formatPrice } from "@/lib/commerce/format";
import type { CollectionSearch } from "@/lib/commerce/queries";
import type { Collection, Product } from "@/lib/commerce";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { occasionHandles } from "./shell";
export type { CollectionSearch };
type GroupKey = "groesse" | "farbe" | "passform" | "anlass";
const bySize = (a: string, b: string) => Number(a) - Number(b) || a.localeCompare(b);
export function CollectionPage({
  collection,
  products,
  catalogue,
  search,
}: {
  collection: Collection;
  products: Product[];
  catalogue: Product[];
  search: CollectionSearch;
}) {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const fitLabel = useFitLabel();
  const navigate = useNavigate();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [dropdown, setDropdown] = useState<string | null>(null);
  const labels = t.collections.filters;
  const label = (key: string, v: string) =>
    key === "passform"
      ? fitLabel(v)
      : key === "anlass"
        ? (t.occasions[v] ?? v)
        : v.charAt(0).toUpperCase() + v.slice(1);
  const change = (key: keyof CollectionSearch, value: string | number | undefined) => {
    navigate({
      to: "/{-$locale}/kollektion/$handle",
      params: { locale: lp, handle: collection.handle },
      search: { ...search, [key]: value },
      replace: true,
      resetScroll: false,
    });
  };
  const toggle = (key: GroupKey, value: string) => {
    const list = search[key]?.split(",") || [];
    change(
      key,
      key === "anlass"
        ? value
        : list.includes(value)
          ? list.filter((v) => v !== value).join(",") || undefined
          : [...list, value].join(","),
    );
    if (key === "anlass") setDropdown(null);
  };
  const sizes = (shoes: boolean) =>
    [
      ...new Set(
        catalogue
          .filter((p) => (p.category === "schuhe") === shoes)
          .flatMap((p) => p.variants.map((v) => v.title)),
      ),
    ].sort(bySize);
  const clothing = sizes(false);
  const shoes = sizes(true);
  const groups = [
    { key: "groesse" as const, values: [...new Set([...clothing, ...shoes])].sort(bySize) },
    { key: "farbe" as const, values: [...new Set(catalogue.map((p) => p.color.name))] },
    {
      key: "passform" as const,
      values: [...new Set(catalogue.flatMap((p) => (p.fit ? [p.fit] : [])))],
    },
    { key: "anlass" as const, values: [...occasionHandles] },
  ].filter((g) => g.values.length);
  // Preisfilter bis zum teuersten Stück, auf 10 Franken aufgerundet (mindestens 100).
  const maxPrice = Math.max(
    100,
    Math.ceil(Math.max(0, ...catalogue.map((p) => p.priceRange.min.amount)) / 10) * 10,
  );
  const priceValue = Math.min(search.preis ?? maxPrice, maxPrice);
  const options = (g: (typeof groups)[number], location: string) => {
    const choices = (values: string[], section = "") =>
      values.map((v) => {
        const controlId = `${id}-${location}-${g.key}-${section}-${v}`;
        return (
          <label key={controlId} htmlFor={controlId}>
            <input
              id={controlId}
              type={g.key === "anlass" ? "radio" : "checkbox"}
              name={`${id}-${location}-${g.key}`}
              checked={Boolean(search[g.key]?.split(",").includes(v))}
              onChange={() => toggle(g.key, v)}
            />
            {label(g.key, v)}
          </label>
        );
      });
    if (g.key === "groesse" && clothing.length && shoes.length)
      return (
        <>
          <fieldset>
            <legend>{t.collections.clothing}</legend>
            {choices(clothing, "clothing")}
          </fieldset>
          <fieldset>
            <legend>{t.collections.shoes}</legend>
            {choices(shoes, "shoes")}
          </fieldset>
        </>
      );
    return g.key === "anlass" ? (
      <fieldset>
        <legend className="sr-only">{labels["anlass"]}</legend>
        {choices(g.values)}
      </fieldset>
    ) : (
      choices(g.values)
    );
  };
  const price = (location: string) => (
    <>
      <label htmlFor={`${id}-${location}-price`}>
        {t.collections.upTo(formatPrice(priceValue, locale))}
      </label>
      <input
        id={`${id}-${location}-price`}
        type="range"
        min="0"
        max={maxPrice}
        step="10"
        value={priceValue}
        onChange={(e) => {
          const value = Number(e.target.value);
          change("preis", value >= maxPrice ? undefined : value);
        }}
      />
    </>
  );
  const desktop = [
    ...groups.map((g) => ({ key: g.key, body: options(g, "desktop") })),
    { key: "preis", body: price("desktop") },
  ].map((g) => (
    <Popover.Root
      key={g.key}
      open={dropdown === g.key}
      onOpenChange={(value) =>
        setDropdown((current) => (value ? g.key : current === g.key ? null : current))
      }
      modal={false}
    >
      <Popover.Trigger asChild>
        <Button variant="icon" className="filter-trigger">
          {labels[g.key]}
          <ChevronDown size={14} />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            const target = event.target;
            if (target instanceof Element && target.closest(".filter-trigger"))
              event.preventDefault();
          }}
          className="filter-popover"
          align="start"
          sideOffset={12}
          collisionPadding={20}
        >
          {g.body}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  ));
  const sort = (location: string) => (
    <select
      id={`${id}-${location}-sort`}
      aria-label={t.collections.sort}
      value={search.sort || "newest"}
      onChange={(e) => {
        change("sort", e.target.value === "newest" ? undefined : e.target.value);
        setDropdown(null);
      }}
    >
      <option value="newest">{t.collections.sortNewest}</option>
      <option value="price-asc">{t.collections.sortPriceAsc}</option>
      <option value="price-desc">{t.collections.sortPriceDesc}</option>
    </select>
  );
  return (
    <div className="container page-body">
      <p className="eyebrow">{t.collections.eyebrow}</p>
      <h1 className="page-title">{collection.title}</h1>
      <p className="page-intro">{collection.description}</p>
      <div className="filters-bar">
        <div className="filter-controls desktop-filter-controls">{desktop}</div>
        <Button variant="tailored" className="mobile-filters" onClick={() => setOpen(true)}>
          <SlidersHorizontal />
          {t.collections.filterAndSort}
        </Button>
        <span className="text-muted text-xs">{t.common.pieces(products.length)}</span>
        {sort("desktop")}
      </div>
      <div className="active-filters">
        {Object.entries(search)
          .filter(([key, value]) => key !== "sort" && value)
          .map(([key, value]) => {
            const text =
              key === "preis"
                ? t.collections.upTo(formatPrice(Number(value), locale))
                : String(value)
                    .split(",")
                    .map((v) => label(key, v))
                    .join(", ");
            return (
              <Button
                variant="icon"
                key={key}
                aria-label={t.collections.remove(`${labels[key] ?? key} ${text}`)}
                onClick={() => change(key as keyof CollectionSearch, undefined)}
              >
                {text}
                <X />
              </Button>
            );
          })}
      </div>
      {products.length ? (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.handle} product={p} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>{t.collections.emptyTitle}</h2>
          <p className="text-muted">{t.collections.emptyText}</p>
          <Button
            onClick={() =>
              navigate({
                to: "/{-$locale}/kollektion/$handle",
                params: { locale: lp, handle: collection.handle },
                search: {},
                replace: true,
              })
            }
          >
            {t.collections.reset}
          </Button>
        </div>
      )}
      <Panel open={open} onOpenChange={setOpen} kind="bottom" title={t.collections.filterAndSort}>
        <div className="filter-controls">
          {groups.map((g) => (
            <div className="mobile-filter-group" key={g.key}>
              <h3>{labels[g.key]}</h3>
              <div className="filter-options">{options(g, "mobile")}</div>
            </div>
          ))}
          <div className="filter-options">{price("mobile")}</div>
          <label htmlFor={`${id}-mobile-sort`}>{t.collections.sort}</label>
          {sort("mobile")}
        </div>
        <Button className="w-full mt-8" onClick={() => setOpen(false)}>
          {t.collections.show(products.length)}
        </Button>
      </Panel>
    </div>
  );
}
