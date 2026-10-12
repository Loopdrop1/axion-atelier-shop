// Produktdaten: Titel, Adresse, Kategorie, Preis, Farbe, Texte DE/EN, Anlässe, Neu/Sale, Outfit.
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { translateTexts, type Category, type Product, type ProductListRow } from "@/lib/admin/api";
import { autoTranslate, type AutoTranslateResult, type Pairs } from "@/lib/admin/auto-translate";
import { centsToInput, parseChf } from "@/lib/admin/money";
import { slugify } from "@/lib/admin/slug";
import { AreaField, Bilingual, CheckField, Panel, SelectField, TextField } from "./ui";

const OCCASIONS = [
  { value: "hochzeit", label: "Hochzeit" },
  { value: "business", label: "Business" },
  { value: "abschlussfeier", label: "Abschlussfeier" },
  { value: "gala", label: "Gala" },
];

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type ProductValues = Omit<Product, "id" | "created_at" | "updated_at">;

interface FormState {
  title_de: string;
  title_en: string;
  handle: string;
  model: string;
  category_id: string;
  status: Product["status"];
  sort: string;
  price: string;
  compare_at: string;
  color_name_de: string;
  color_name_en: string;
  color_hex: string;
  description_de: string;
  description_en: string;
  material_de: string;
  material_en: string;
  care_de: string;
  care_en: string;
  fit_note_de: string;
  fit_note_en: string;
  fit: string;
  occasions: string[];
  neu: boolean;
  sale: boolean;
  otherTags: string[];
  outfit_handles: string[];
}

function initial(product: Product | null, categories: Category[]): FormState {
  const p = product;
  return {
    title_de: p?.title_de ?? "",
    title_en: p?.title_en ?? "",
    handle: p?.handle ?? "",
    model: p?.model ?? "",
    category_id: p?.category_id ?? categories[0]?.id ?? "",
    status: p?.status ?? "draft",
    sort: String(p?.sort ?? 0),
    price: centsToInput(p?.price_cents ?? null),
    compare_at: centsToInput(p?.compare_at_cents ?? null),
    color_name_de: p?.color_name_de ?? "",
    color_name_en: p?.color_name_en ?? "",
    color_hex: p?.color_hex ?? "#1E3A2F",
    description_de: p?.description_de ?? "",
    description_en: p?.description_en ?? "",
    material_de: p?.material_de ?? "",
    material_en: p?.material_en ?? "",
    care_de: p?.care_de ?? "",
    care_en: p?.care_en ?? "",
    fit_note_de: p?.fit_note_de ?? "",
    fit_note_en: p?.fit_note_en ?? "",
    fit: p?.fit ?? "",
    occasions: p?.occasions ?? [],
    neu: p?.tags.includes("neu") ?? true,
    sale: p?.tags.includes("sale") ?? false,
    otherTags: (p?.tags ?? []).filter((t) => t !== "neu" && t !== "sale"),
    outfit_handles: p?.outfit_handles ?? [],
  };
}

const orNull = (v: string) => v.trim() || null;

/** Texte mit englischer Fassung; beim Speichern übersetzt das Admin fehlende oder veraltete automatisch. */
const TEXTS = ["title", "color_name", "description", "material", "care", "fit_note"] as const;
const MAX_EN: Record<(typeof TEXTS)[number], number> = {
  title: 120,
  color_name: 60,
  description: 4000,
  material: 500,
  care: 500,
  fit_note: 500,
};

function textPairs(f: FormState): Pairs {
  return Object.fromEntries(TEXTS.map((k) => [k, { de: f[`${k}_de`], en: f[`${k}_en`] }])) as Pairs;
}

export function ProductForm({
  product,
  categories,
  products,
  onSave,
}: {
  product: Product | null;
  categories: Category[];
  products: ProductListRow[];
  onSave: (values: ProductValues, translation: AutoTranslateResult) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(() => initial(product, categories));
  // Stand beim Öffnen: Was seither auf Deutsch geändert wurde, übersetzt das Admin neu.
  const [baseline] = useState<FormState>(() => initial(product, categories));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [busy, setBusy] = useState(false);
  const [handleTouched, setHandleTouched] = useState(Boolean(product));
  const [modelTouched, setModelTouched] = useState(Boolean(product));
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const text = (key: keyof FormState) => ({
    value: form[key] as string,
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
  });
  const others = useMemo(
    () => products.filter((p) => p.id !== product?.id),
    [products, product?.id],
  );
  const handleChanged = product && product.status === "active" && form.handle !== product.handle;

  function updateTitle(value: string) {
    setForm((f) => {
      const next = { ...f, title_de: value };
      if (!handleTouched) next.handle = slugify(`${value} ${f.color_name_de}`);
      if (!modelTouched) next.model = slugify(value);
      return next;
    });
  }

  function updateColor(value: string) {
    setForm((f) => ({
      ...f,
      color_name_de: value,
      ...(handleTouched ? {} : { handle: slugify(`${f.title_de} ${value}`) }),
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    const price = parseChf(form.price);
    const compare = form.compare_at.trim() ? parseChf(form.compare_at) : null;
    if (!form.title_de.trim()) next.title_de = "Pflichtfeld";
    if (!SLUG.test(form.handle))
      next.handle = "Nur Kleinbuchstaben, Zahlen und Bindestriche, z. B. anzug-limmat-marine";
    if (!SLUG.test(form.model))
      next.model = "Nur Kleinbuchstaben, Zahlen und Bindestriche, z. B. anzug-limmat";
    if (!form.category_id) next.category_id = "Bitte eine Kategorie wählen";
    if (price === null) next.price = "Bitte einen Preis in Franken eingeben, z. B. 489 oder 489.50";
    if (form.compare_at.trim() && (compare === null || price === null || compare <= price))
      next.compare_at = "Der Streichpreis muss höher sein als der Preis.";
    if (!form.color_name_de.trim()) next.color_name_de = "Pflichtfeld";
    if (!/^#[0-9A-Fa-f]{6}$/.test(form.color_hex)) next.color_hex = "Farbcode wie #1E3A2F";
    setErrors(next);
    if (Object.keys(next).length || price === null) return;
    setBusy(true);
    try {
      const translation = await autoTranslate(
        textPairs(baseline),
        textPairs(form),
        translateTexts,
        MAX_EN,
      );
      const en = Object.fromEntries(
        TEXTS.map((k) => [`${k}_en`, translation.pairs[k]!.en]),
      ) as Pick<FormState, `${(typeof TEXTS)[number]}_en`>;
      const f = { ...form, ...en };
      setForm(f);
      await onSave(
        {
          title_de: f.title_de.trim(),
          title_en: orNull(f.title_en),
          handle: f.handle,
          model: f.model,
          category_id: f.category_id,
          status: f.status,
          sort: Number(f.sort) || 0,
          price_cents: price,
          compare_at_cents: compare,
          color_name_de: f.color_name_de.trim(),
          color_name_en: orNull(f.color_name_en),
          color_hex: f.color_hex.toUpperCase(),
          description_de: f.description_de.trim(),
          description_en: orNull(f.description_en),
          material_de: orNull(f.material_de),
          material_en: orNull(f.material_en),
          care_de: orNull(f.care_de),
          care_en: orNull(f.care_en),
          fit_note_de: orNull(f.fit_note_de),
          fit_note_en: orNull(f.fit_note_en),
          fit: orNull(f.fit),
          occasions: f.occasions,
          tags: [...(f.neu ? ["neu"] : []), ...(f.sale ? ["sale"] : []), ...f.otherTags],
          outfit_handles: f.outfit_handles,
        },
        translation,
      );
    } catch {
      // Meldung zeigt die Seite (notify); Eingaben bleiben stehen.
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="admin-product-form">
      <Panel title="Grunddaten">
        <div className="admin-form">
          <Bilingual
            de={
              <TextField
                label="Titel"
                required
                maxLength={120}
                value={form.title_de}
                onChange={(e) => updateTitle(e.target.value)}
                error={errors.title_de}
              />
            }
            en={<TextField label="Title" maxLength={120} {...text("title_en")} />}
          />
          <div className="admin-grid-2">
            <TextField
              label="Adresse im Shop"
              hint={
                handleChanged
                  ? "Achtung: Alte Links auf dieses Produkt führen danach ins Leere."
                  : `/produkt/${form.handle || "…"}`
              }
              value={form.handle}
              onChange={(e) => {
                setHandleTouched(true);
                set("handle", e.target.value.toLowerCase());
              }}
              error={errors.handle}
            />
            <TextField
              label="Modell"
              hint="Gleiches Modell in anderen Farben erscheint auf der Produktseite als Farbauswahl."
              value={form.model}
              onChange={(e) => {
                setModelTouched(true);
                set("model", e.target.value.toLowerCase());
              }}
              error={errors.model}
            />
          </div>
          <div className="admin-grid-3">
            <SelectField
              label="Kategorie"
              value={form.category_id}
              onChange={(e) => set("category_id", e.target.value)}
              options={categories.map((c) => ({ value: c.id, label: c.name_de }))}
            />
            <SelectField
              label="Status"
              value={form.status}
              onChange={(e) => set("status", e.target.value as Product["status"])}
              options={[
                { value: "draft", label: "Entwurf (nicht sichtbar)" },
                { value: "active", label: "Aktiv (im Shop)" },
                { value: "archived", label: "Archiviert (nicht sichtbar)" },
              ]}
            />
            <TextField
              label="Reihenfolge"
              hint="Kleinere Zahl = weiter vorne"
              inputMode="numeric"
              value={form.sort}
              onChange={(e) => set("sort", e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
        </div>
      </Panel>

      <Panel title="Preis und Farbe">
        <div className="admin-form">
          <div className="admin-grid-2">
            <TextField
              label="Preis (CHF, inkl. MWST)"
              inputMode="decimal"
              {...text("price")}
              error={errors.price}
            />
            <TextField
              label="Streichpreis (CHF, freiwillig)"
              hint="Früherer Preis, erscheint durchgestrichen. Nur angeben, wenn er wirklich verlangt wurde."
              inputMode="decimal"
              {...text("compare_at")}
              error={errors.compare_at}
            />
          </div>
          <Bilingual
            de={
              <TextField
                label="Farbname"
                maxLength={60}
                value={form.color_name_de}
                onChange={(e) => updateColor(e.target.value)}
                error={errors.color_name_de}
              />
            }
            en={<TextField label="Colour name" maxLength={60} {...text("color_name_en")} />}
          />
          <div className="admin-color">
            <input
              type="color"
              aria-label="Farbe wählen"
              value={/^#[0-9A-Fa-f]{6}$/.test(form.color_hex) ? form.color_hex : "#000000"}
              onChange={(e) => set("color_hex", e.target.value.toUpperCase())}
            />
            <TextField
              label="Farbcode für das Farbfeld"
              {...text("color_hex")}
              error={errors.color_hex}
            />
          </div>
        </div>
      </Panel>

      <Panel title="Texte">
        <div className="admin-form">
          <Bilingual
            de={
              <AreaField
                label="Beschreibung"
                rows={5}
                maxLength={4000}
                {...text("description_de")}
              />
            }
            en={
              <AreaField
                label="Description"
                rows={5}
                maxLength={4000}
                {...text("description_en")}
              />
            }
          />
          <Bilingual
            de={<TextField label="Material" maxLength={500} {...text("material_de")} />}
            en={<TextField label="Material" maxLength={500} {...text("material_en")} />}
          />
          <Bilingual
            de={<TextField label="Pflege" maxLength={500} {...text("care_de")} />}
            en={<TextField label="Care" maxLength={500} {...text("care_en")} />}
          />
          <Bilingual
            de={<TextField label="Hinweis zur Passform" maxLength={500} {...text("fit_note_de")} />}
            en={<TextField label="Fit note" maxLength={500} {...text("fit_note_en")} />}
          />
          <SelectField
            label="Passform (Filter im Shop)"
            value={form.fit}
            onChange={(e) => set("fit", e.target.value)}
            options={[
              { value: "", label: "keine Angabe" },
              { value: "Slim Fit", label: "Slim Fit (schmal)" },
              { value: "Regular Fit", label: "Regular Fit (gerade)" },
            ]}
          />
        </div>
      </Panel>

      <Panel title="Sichtbarkeit und Kombinationen">
        <div className="admin-form">
          <div className="admin-grid-2">
            <CheckField
              label="Neu"
              hint="Erscheint unter «Neu» und auf der Startseite bei den Neuheiten, mit Badge."
              checked={form.neu}
              onChange={(v) => set("neu", v)}
            />
            <CheckField
              label="Sale"
              hint="Erscheint unter «Sale», mit Badge. Dazu einen Streichpreis setzen."
              checked={form.sale}
              onChange={(v) => set("sale", v)}
            />
          </div>
          <fieldset className="admin-fieldset">
            <legend>Anlässe (Filter und Menü «Anlässe»)</legend>
            <div className="admin-checks">
              {OCCASIONS.map((o) => (
                <CheckField
                  key={o.value}
                  label={o.label}
                  checked={form.occasions.includes(o.value)}
                  onChange={(v) =>
                    set(
                      "occasions",
                      v
                        ? [...form.occasions, o.value]
                        : form.occasions.filter((x) => x !== o.value),
                    )
                  }
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="admin-fieldset">
            <legend>Komplettes Outfit (auf der Produktseite zusammen anbieten)</legend>
            <div className="admin-checks admin-checks-scroll">
              {others.map((p) => (
                <CheckField
                  key={p.id}
                  label={`${p.title_de} · ${p.color_name_de}`}
                  checked={form.outfit_handles.includes(p.handle)}
                  onChange={(v) =>
                    set(
                      "outfit_handles",
                      v
                        ? [...form.outfit_handles, p.handle]
                        : form.outfit_handles.filter((h) => h !== p.handle),
                    )
                  }
                />
              ))}
            </div>
          </fieldset>
        </div>
      </Panel>

      <div className="admin-savebar">
        <Button type="submit" variant="admin" disabled={busy}>
          {busy ? "Wird gespeichert …" : product ? "Änderungen speichern" : "Produkt anlegen"}
        </Button>
        {Object.keys(errors).length > 0 && (
          <p className="admin-error">Bitte die markierten Felder prüfen.</p>
        )}
      </div>
    </form>
  );
}
