import { useId, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as Popover from "@radix-ui/react-popover";
import { SlidersHorizontal, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "./primitives";
import { ProductCard } from "./product-card";
import { pieceCount } from "@/lib/commerce/presentation";
import { formatPrice } from "@/lib/commerce/format";
import type { Collection, Product } from "@/lib/commerce";
export interface CollectionSearch {
  anlass?: string | undefined;
  groesse?: string | undefined;
  farbe?: string | undefined;
  passform?: string | undefined;
  preis?: number | undefined;
  sort?: "newest" | "price-asc" | "price-desc" | undefined;
}
const labels: Record<string, string> = { groesse: "Grösse", farbe: "Farbe", passform: "Passform", anlass: "Anlass", preis: "Preis" };
const label = (v: string) => v === "Slim Fit" ? "Schmale Passform" : v === "Regular Fit" ? "Gerade Passform" : v.charAt(0).toUpperCase() + v.slice(1);
export function CollectionPage({ collection, products, catalogue, search }: {
  collection: Collection; products: Product[]; catalogue: Product[]; search: CollectionSearch;
}) {
  const navigate = useNavigate();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [dropdown, setDropdown] = useState<string | null>(null);
  const change = (key: keyof CollectionSearch, value: string | number | undefined) => {
    navigate({ to: "/kollektion/$handle", params: { handle: collection.handle }, search: { ...search, [key]: value }, replace: true, resetScroll: false });
  };
  const toggle = (key: "groesse" | "farbe" | "passform" | "anlass", value: string) => {
    const list = search[key]?.split(",") || [];
    change(key, key === "anlass" ? value : list.includes(value) ? list.filter(v => v !== value).join(",") || undefined : [...list, value].join(","));
    if (key === "anlass") setDropdown(null);
  };
  const sizes = (category: "clothing" | "shoes") => [...new Set(catalogue.filter(p => (p.category === "schuhe") === (category === "shoes")).flatMap(p => p.variants.map(v => v.title)))].sort((a,b) => Number(a)-Number(b));
  const clothing = sizes("clothing");
  const shoes = sizes("shoes");
  const groups = [
    { key: "groesse" as const, values: [...new Set([...clothing, ...shoes])].sort((a,b) => Number(a)-Number(b)) },
    { key: "farbe" as const, values: [...new Set(catalogue.map(p => p.color.name))] },
    { key: "passform" as const, values: [...new Set(catalogue.flatMap(p => p.fit ? [p.fit] : []))] },
    { key: "anlass" as const, values: ["hochzeit", "business", "abschlussfeier", "gala"] },
  ].filter(g => g.values.length);
  const options = (g: typeof groups[number], location: string) => {
    const choices = (values: string[], section = "") => values.map(v => {
      const controlId = `${id}-${location}-${g.key}-${section}-${v}`;
      return <label key={controlId} htmlFor={controlId}><input id={controlId} type={g.key === "anlass" ? "radio" : "checkbox"} name={`${id}-${location}-${g.key}`} checked={Boolean(search[g.key]?.split(",").includes(v))} onChange={() => toggle(g.key, v)} />{label(v)}</label>;
    });
    if (g.key === "groesse" && clothing.length && shoes.length) return <><fieldset><legend>Kleidung</legend>{choices(clothing, "clothing")}</fieldset><fieldset><legend>Schuhe</legend>{choices(shoes, "shoes")}</fieldset></>;
    return g.key === "anlass" ? <fieldset><legend className="sr-only">Anlass</legend>{choices(g.values)}</fieldset> : choices(g.values);
  };
  const price = (location: string) => <><label htmlFor={`${id}-${location}-price`}>Bis {formatPrice(search.preis ?? 500)}</label><input id={`${id}-${location}-price`} type="range" min="100" max="500" step="10" value={search.preis ?? 500} onChange={e => change("preis", Number(e.target.value))} /></>;
  const desktop = [...groups.map(g => ({ key: g.key, body: options(g, "desktop") })), { key: "preis", body: price("desktop") }].map(g => <Popover.Root key={g.key} open={dropdown === g.key} onOpenChange={value => setDropdown(current => value ? g.key : current === g.key ? null : current)} modal={false}><Popover.Trigger asChild><Button variant="icon" className="filter-trigger">{labels[g.key]}<ChevronDown size={14} /></Button></Popover.Trigger><Popover.Portal><Popover.Content onCloseAutoFocus={event => event.preventDefault()} onInteractOutside={event => {
      const target = event.target;
      if (target instanceof Element && target.closest(".filter-trigger")) event.preventDefault();
    }} className="filter-popover" align="start" sideOffset={12} collisionPadding={20}>{g.body}</Popover.Content></Popover.Portal></Popover.Root>);
  const sort = (location: string) => <select id={`${id}-${location}-sort`} aria-label="Sortieren" value={search.sort || "newest"} onChange={e => { change("sort", e.target.value); setDropdown(null); }}><option value="newest">Neuheiten</option><option value="price-asc">Preis aufsteigend</option><option value="price-desc">Preis absteigend</option></select>;
  return <div className="container page-body">
    <p className="eyebrow">Axion Kollektion</p><h1 className="page-title">{collection.title}</h1><p className="page-intro">{collection.description}</p>
    <div className="filters-bar"><div className="filter-controls desktop-filter-controls">{desktop}</div><Button variant="tailored" className="mobile-filters" onClick={() => setOpen(true)}><SlidersHorizontal />Filtern und sortieren</Button><span className="text-muted text-xs">{pieceCount(products.length)}</span>{sort("desktop")}</div>
    <div className="active-filters">{Object.entries(search).filter(([key,value]) => key !== "sort" && value).map(([key,value]) => { const text = key === "preis" ? `Bis ${formatPrice(Number(value))}` : String(value).split(",").map(label).join(", "); return <Button variant="icon" key={key} aria-label={`${labels[key]} ${key === "preis" ? formatPrice(Number(value)) : text} entfernen`} onClick={() => change(key as keyof CollectionSearch, undefined)}>{text}<X /></Button>; })}</div>
    {products.length ? <div className="product-grid">{products.map(p => <ProductCard key={p.handle} product={p} />)}</div> : <div className="empty-state"><h2>Keine passenden Stücke</h2><p className="text-muted">Versuche eine andere Auswahl.</p><Button onClick={() => navigate({ to: "/kollektion/$handle", params: { handle: collection.handle }, search: {}, replace: true })}>Filter zurücksetzen</Button></div>}
    <Panel open={open} onOpenChange={setOpen} kind="bottom" title="Filtern und sortieren"><div className="filter-controls">{groups.map(g => <div className="mobile-filter-group" key={g.key}><h3>{labels[g.key]}</h3><div className="filter-options">{options(g, "mobile")}</div></div>)}<div className="filter-options">{price("mobile")}</div><label htmlFor={`${id}-mobile-sort`}>Sortieren</label>{sort("mobile")}</div><Button className="w-full mt-8" onClick={() => setOpen(false)}>{pieceCount(products.length)} ansehen</Button></Panel>
  </div>;
}
