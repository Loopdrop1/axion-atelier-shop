// Startseite und Laufband bearbeiten (Tabelle site_content). Leere Felder zeigen den Standardtext.
import { useMemo, useRef, useState, type MouseEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getContent,
  listProducts,
  saveContent,
  translateTexts,
  uploadSiteImage,
  type ProductListRow,
} from "@/lib/admin/api";
import { autoTranslate, type AutoTranslateResult } from "@/lib/admin/auto-translate";
import {
  applyBlockPairs,
  applyItemPairs,
  blockPairs,
  itemPairs,
} from "@/lib/admin/content-translate";
import type { Json } from "@/integrations/supabase/types";
import { messages } from "@/i18n/messages";
import { imageUrl } from "@/lib/commerce/mapping";
import { invalidateCatalog } from "@/lib/commerce/source";
import { useSession } from "@/lib/account/session";
import {
  AreaField,
  Bilingual,
  ErrorBox,
  Loading,
  notify,
  PageHeader,
  Panel,
  SelectField,
  TextField,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/inhalte")({
  component: Content,
});

type Obj = Record<string, Json>;
type Lang = "de" | "en";
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");

interface FieldDef {
  name: string;
  label: string;
  multiline?: boolean;
  hint?: string;
}

/** Felder je Sprache unter value.de / value.en; Standardtexte als Platzhalter. */
function LocalizedFields({
  value,
  fields,
  defaults,
  onChange,
}: {
  value: Obj;
  fields: FieldDef[];
  defaults: Record<Lang, Record<string, string>>;
  onChange: (next: Obj) => void;
}) {
  const field = (lang: Lang, f: FieldDef) => {
    const block = isObj(value[lang]) ? (value[lang] as Obj) : {};
    const props = {
      label: f.label,
      value: str(block[f.name]),
      placeholder: defaults[lang][f.name] ?? "",
      onChange: (e: { target: { value: string } }) =>
        onChange({ ...value, [lang]: { ...block, [f.name]: e.target.value } }),
    };
    return f.multiline ? (
      <AreaField key={f.name} rows={3} hint={f.hint} {...props} />
    ) : (
      <TextField key={f.name} hint={f.hint} {...props} />
    );
  };
  return (
    <Bilingual
      de={<div className="admin-form">{fields.map((f) => field("de", f))}</div>}
      en={<div className="admin-form">{fields.map((f) => field("en", f))}</div>}
    />
  );
}

/** Leere Texte entfernen, damit der Shop den Standard nimmt. */
function clean(value: Obj): Obj {
  const out: Obj = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === "de" || k === "en") {
      if (isObj(v)) {
        const texts = Object.fromEntries(
          Object.entries(v).filter(([, t]) => typeof t !== "string" || t.trim()),
        );
        if (Object.keys(texts).length) out[k] = texts;
      }
    } else out[k] = v;
  }
  return out;
}

function useSave() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return async (key: string, value: Json, translation?: AutoTranslateResult): Promise<boolean> => {
    try {
      await saveContent(key, value, user!.id);
      invalidateCatalog();
      void queryClient.invalidateQueries({ queryKey: ["admin", "content"] });
      notify.saved(
        "Gespeichert. Im Shop sichtbar nach dem nächsten Laden der Seite (spätestens nach 30 Sekunden).",
        translation,
      );
      return true;
    } catch (error) {
      notify.error(error);
      return false;
    }
  };
}

/** Englisch zum Block ergänzen: fehlende oder veraltete Texte automatisch übersetzen. */
async function translateBlock(base: Obj, next: Obj, fields: string[]) {
  const translation = await autoTranslate(
    blockPairs(base, fields),
    blockPairs(next, fields),
    translateTexts,
    { image_alt: 300 },
  );
  return { value: applyBlockPairs(next, translation.pairs), translation };
}

const home = { de: messages.de.home, en: messages.en.home };
const flatten = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "string")) as Record<
    string,
    string
  >;

function Content() {
  const content = useQuery({ queryKey: ["admin", "content"], queryFn: getContent });
  const products = useQuery({ queryKey: ["admin", "products"], queryFn: listProducts });
  if (content.isLoading || products.isLoading) return <Loading />;
  if (content.isError || products.isError)
    return <ErrorBox error={content.error ?? products.error} />;
  const data = content.data ?? {};
  const obj = (key: string): Obj => (isObj(data[key]) ? (data[key] as Obj) : {});
  return (
    <>
      <PageHeader
        title="Startseite und Laufband"
        description="Texte auf Deutsch und Englisch. Leere Felder zeigen den grauen Standardtext."
      />
      <Announcements value={obj("announcements")} />
      <TextBlock
        title="Einstieg (oben, mit 3D-Logo)"
        contentKey="home.hero"
        value={obj("home.hero")}
        fields={[
          { name: "eyebrow", label: "Kleine Zeile oben" },
          { name: "title", label: "Titel", multiline: true, hint: "Zeilenumbruch mit Enter" },
          { name: "text", label: "Text", multiline: true },
          { name: "primary", label: "Knopf 1 (zur Kollektion)" },
          { name: "secondary", label: "Knopf 2 (zu den Anzügen)" },
        ]}
        defaults={{ de: flatten(home.de.hero), en: flatten(home.en.hero) }}
      />
      <TextBlock
        title="Kollektionen"
        contentKey="home.collections"
        value={obj("home.collections")}
        fields={[
          { name: "eyebrow", label: "Kleine Zeile oben" },
          { name: "title", label: "Titel" },
        ]}
        defaults={{ de: flatten(home.de.collections), en: flatten(home.en.collections) }}
      />
      <TextBlock
        title="Neuheiten"
        contentKey="home.new"
        value={obj("home.new")}
        fields={[
          { name: "eyebrow", label: "Kleine Zeile oben" },
          { name: "title", label: "Titel" },
          { name: "link", label: "Link-Text" },
        ]}
        defaults={{ de: flatten(home.de.newArrivals), en: flatten(home.en.newArrivals) }}
      />
      <LookBlock value={obj("home.look")} products={products.data ?? []} />
      <TextBlock
        title="Anlässe"
        contentKey="home.occasions"
        value={obj("home.occasions")}
        fields={[
          { name: "eyebrow", label: "Kleine Zeile oben" },
          { name: "title", label: "Titel" },
          { name: "hochzeit", label: "Text Hochzeit" },
          { name: "business", label: "Text Business" },
          { name: "abschlussfeier", label: "Text Abschlussfeier" },
          { name: "gala", label: "Text Gala" },
        ]}
        defaults={{
          de: { ...flatten(home.de.occasions), ...home.de.occasions.texts },
          en: { ...flatten(home.en.occasions), ...home.en.occasions.texts },
        }}
      />
      <TextBlock
        title="Geschichte (Bild mit Text unten)"
        contentKey="home.story"
        value={obj("home.story")}
        image="story"
        fields={[
          { name: "eyebrow", label: "Kleine Zeile oben" },
          { name: "title", label: "Titel", multiline: true },
          { name: "text", label: "Text", multiline: true },
          { name: "link", label: "Link-Text (zu «Über uns»)" },
        ]}
        defaults={{ de: flatten(home.de.story), en: flatten(home.en.story) }}
      />
    </>
  );
}

function Announcements({ value }: { value: Obj }) {
  const save = useSave();
  const initial = Array.isArray(value["items"])
    ? value["items"].filter(isObj).map((i) => ({ de: str(i["de"]), en: str(i["en"]) }))
    : [];
  const [items, setItems] = useState(initial);
  const [base, setBase] = useState(initial);
  const [busy, setBusy] = useState(false);
  const move = (i: number, d: -1 | 1) =>
    setItems((list) => {
      const next = [...list];
      const [x] = next.splice(i, 1);
      next.splice(i + d, 0, x!);
      return next;
    });
  return (
    <Panel
      title="Laufband"
      description="Kurze Sätze ganz oben auf jeder Seite, wechseln automatisch. Ohne Einträge erscheinen die Standardtexte."
      actions={
        <Button
          variant="outline"
          size="sm"
          disabled={items.length >= 6}
          onClick={() => setItems((l) => [...l, { de: "", en: "" }])}
        >
          <Plus /> Satz hinzufügen
        </Button>
      }
    >
      <div className="admin-form">
        {items.map((item, i) => (
          <div key={i} className="admin-repeat">
            <Bilingual
              de={
                <TextField
                  label={`Satz ${i + 1}`}
                  maxLength={120}
                  value={item.de}
                  onChange={(e) =>
                    setItems((l) => l.map((x, j) => (j === i ? { ...x, de: e.target.value } : x)))
                  }
                />
              }
              en={
                <TextField
                  label={`Sentence ${i + 1}`}
                  maxLength={120}
                  value={item.en}
                  onChange={(e) =>
                    setItems((l) => l.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)))
                  }
                />
              }
            />
            <div className="admin-repeat-actions">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Nach oben"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Nach unten"
                disabled={i === items.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Entfernen"
                onClick={() => setItems((l) => l.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        ))}
        <Button
          variant="admin"
          className="admin-save"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const translation = await autoTranslate(
              itemPairs(base),
              itemPairs(items),
              translateTexts,
              Object.fromEntries(items.map((_, i) => [`item:${i}`, 120])),
            );
            const next = applyItemPairs(items, translation.pairs);
            setItems(next);
            const list = next
              .filter((x) => x.de.trim())
              .map((x) => ({ de: x.de.trim(), ...(x.en.trim() ? { en: x.en.trim() } : {}) }));
            if (await save("announcements", { items: list }, translation)) setBase(next);
            setBusy(false);
          }}
        >
          Laufband speichern
        </Button>
      </div>
    </Panel>
  );
}

/** Bild hochladen: name = Feld im Inhalt («image» oder «image_mobile» fürs Handy). */
function ImageUpload({
  value,
  onChange,
  folder,
  name,
  label,
  hint,
}: {
  value: Obj;
  onChange: (next: Obj) => void;
  folder: string;
  name: "image" | "image_mobile";
  label: string;
  hint: string;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const src = imageUrl(str(value[name]), "site-media");
  return (
    <div className="admin-image-field">
      {src ? <img src={src} alt="" /> : <span className="admin-thumb" />}
      <div>
        <input
          ref={file}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try {
              const image = await uploadSiteImage(f, folder);
              onChange({
                ...value,
                [name]: image.path,
                [`${name}_width`]: image.width,
                [`${name}_height`]: image.height,
              });
            } catch (err) {
              notify.error(err);
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button variant="outline" size="sm" disabled={busy} onClick={() => file.current?.click()}>
          <Upload /> {busy ? "Wird hochgeladen …" : label}
        </Button>
        {name === "image_mobile" && src && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const {
                image_mobile: _a,
                image_mobile_width: _b,
                image_mobile_height: _c,
                ...rest
              } = value;
              onChange(rest);
            }}
          >
            <Trash2 /> Handy-Bild entfernen
          </Button>
        )}
        <p className="admin-hint">{hint}</p>
      </div>
    </div>
  );
}

function ImageField({
  value,
  onChange,
  folder,
  mobile = false,
}: {
  value: Obj;
  onChange: (next: Obj) => void;
  folder: string;
  /** Zusätzlich ein eigenes Bild fürs Handy (hoch) */
  mobile?: boolean;
}) {
  const alt = isObj(value["image_alt"]) ? (value["image_alt"] as Obj) : {};
  return (
    <div className="admin-form">
      <ImageUpload
        value={value}
        onChange={onChange}
        folder={folder}
        name="image"
        label="Bild ersetzen"
        hint={
          mobile
            ? "Querformat für den Computer. Neues Bild erst nach «Speichern» im Shop."
            : "Neues Bild erst nach «Speichern» im Shop."
        }
      />
      {mobile && (
        <ImageUpload
          value={value}
          onChange={onChange}
          folder={folder}
          name="image_mobile"
          label="Bild fürs Handy"
          hint="Freiwillig, im Hochformat. Ohne eigenes Bild zeigt das Handy das Bild oben."
        />
      )}
      <Bilingual
        de={
          <TextField
            label="Bildbeschreibung"
            maxLength={300}
            value={str(alt["de"])}
            onChange={(e) => onChange({ ...value, image_alt: { ...alt, de: e.target.value } })}
          />
        }
        en={
          <TextField
            label="Image description"
            maxLength={300}
            value={str(alt["en"])}
            onChange={(e) => onChange({ ...value, image_alt: { ...alt, en: e.target.value } })}
          />
        }
      />
    </div>
  );
}

function TextBlock({
  title,
  contentKey,
  value,
  fields,
  defaults,
  image,
}: {
  title: string;
  contentKey: string;
  value: Obj;
  fields: FieldDef[];
  defaults: Record<Lang, Record<string, string>>;
  image?: string;
}) {
  const save = useSave();
  const [draft, setDraft] = useState<Obj>(value);
  const [base, setBase] = useState<Obj>(value);
  const [busy, setBusy] = useState(false);
  const names = fields.map((f) => f.name);
  return (
    <Panel title={title}>
      <div className="admin-form">
        {image && <ImageField value={draft} onChange={setDraft} folder={image} mobile />}
        <LocalizedFields value={draft} fields={fields} defaults={defaults} onChange={setDraft} />
        <Button
          variant="admin"
          className="admin-save"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const { value: next, translation } = await translateBlock(base, draft, names);
            setDraft(next);
            const cleaned = clean(next);
            if (await save(contentKey, cleaned, translation)) setBase(cleaned);
            setBusy(false);
          }}
        >
          Speichern
        </Button>
      </div>
    </Panel>
  );
}

const LOOK_TEXTS: FieldDef[] = [
  { name: "eyebrow", label: "Kleine Zeile oben" },
  { name: "title", label: "Titel", multiline: true },
  { name: "text", label: "Text" },
  { name: "total", label: "Text vor dem Gesamtpreis" },
  { name: "cta", label: "Knopf" },
];
const LOOK_FIELDS = LOOK_TEXTS.map((f) => f.name);

interface Spot {
  handle: string;
  key: string;
  label: { de: string; en: string };
  x: number;
  y: number;
}

function LookBlock({ value, products }: { value: Obj; products: ProductListRow[] }) {
  const save = useSave();
  const [draft, setDraft] = useState<Obj>(value);
  const [base, setBase] = useState<Obj>(value);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const spots: Spot[] = useMemo(
    () =>
      (Array.isArray(draft["hotspots"]) ? draft["hotspots"] : []).filter(isObj).map((h, i) => ({
        handle: str(h["handle"]),
        key: str(h["key"]) || `punkt-${i + 1}`,
        label: isObj(h["label"])
          ? { de: str(h["label"]["de"]), en: str(h["label"]["en"]) }
          : { de: "", en: "" },
        x: Number(h["x"]) || 50,
        y: Number(h["y"]) || 50,
      })),
    [draft],
  );
  const active = products.filter((p) => p.status === "active");
  const setSpots = (next: Spot[]) => setDraft((d) => ({ ...d, hotspots: next as unknown as Json }));
  const src = imageUrl(str(draft["image"]), "site-media") ?? imageUrl("asset:look", "site-media");

  function place(event: MouseEvent<HTMLDivElement>) {
    if (!spots[selected]) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * 100);
    setSpots(
      spots.map((s, i) =>
        i === selected
          ? { ...s, x: Math.min(97, Math.max(3, x)), y: Math.min(97, Math.max(3, y)) }
          : s,
      ),
    );
  }

  return (
    <Panel
      title="Komplettes Outfit (Bild mit Punkten)"
      description="Punkte auf dem Bild führen zu den Produkten. Punkt auswählen, dann ins Bild klicken, um ihn zu setzen."
    >
      <div className="admin-form">
        <ImageField value={draft} onChange={setDraft} folder="look" />
        <div className="admin-look">
          <div className="admin-look-image" onClick={place} role="presentation">
            {src && <img src={src} alt="" />}
            {spots.map((s, i) => (
              <button
                key={i}
                type="button"
                className={`admin-spot ${i === selected ? "active" : ""}`}
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
                aria-label={`Punkt ${i + 1} auswählen`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(i);
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="admin-form">
            {spots.map((s, i) => (
              <div
                key={i}
                className={`admin-repeat ${i === selected ? "selected" : ""}`}
                onFocus={() => setSelected(i)}
              >
                <p className="admin-lang">
                  Punkt {i + 1} · {s.x} % von links, {s.y} % von oben
                </p>
                <SelectField
                  label="Produkt"
                  value={s.handle}
                  onChange={(e) =>
                    setSpots(spots.map((x, j) => (j === i ? { ...x, handle: e.target.value } : x)))
                  }
                  options={[
                    { value: "", label: "Bitte wählen" },
                    ...active.map((p) => ({
                      value: p.handle,
                      label: `${p.title_de} · ${p.color_name_de}`,
                    })),
                  ]}
                />
                <Bilingual
                  de={
                    <TextField
                      label="Bezeichnung"
                      maxLength={40}
                      value={s.label.de}
                      onChange={(e) =>
                        setSpots(
                          spots.map((x, j) =>
                            j === i ? { ...x, label: { ...x.label, de: e.target.value } } : x,
                          ),
                        )
                      }
                    />
                  }
                  en={
                    <TextField
                      label="Label"
                      maxLength={40}
                      value={s.label.en}
                      onChange={(e) =>
                        setSpots(
                          spots.map((x, j) =>
                            j === i ? { ...x, label: { ...x.label, en: e.target.value } } : x,
                          ),
                        )
                      }
                    />
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSpots(spots.filter((_, j) => j !== i))}
                >
                  <Trash2 /> Punkt entfernen
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={spots.length >= 6}
              onClick={() => {
                setSpots([
                  ...spots,
                  {
                    handle: "",
                    key: `punkt-${spots.length + 1}`,
                    label: { de: "", en: "" },
                    x: 50,
                    y: 50,
                  },
                ]);
                setSelected(spots.length);
              }}
            >
              <Plus /> Punkt hinzufügen
            </Button>
          </div>
        </div>
        <SelectField
          label="Knopf «Outfit zusammenstellen» führt zu"
          value={str(draft["cta_handle"])}
          onChange={(e) => setDraft((d) => ({ ...d, cta_handle: e.target.value }))}
          options={[
            { value: "", label: "erstes Produkt der Punkte" },
            ...active.map((p) => ({
              value: p.handle,
              label: `${p.title_de} · ${p.color_name_de}`,
            })),
          ]}
        />
        <LocalizedFields
          value={draft}
          onChange={setDraft}
          fields={LOOK_TEXTS}
          defaults={{ de: flatten(home.de.look), en: flatten(home.en.look) }}
        />
        <Button
          variant="admin"
          className="admin-save"
          disabled={busy}
          onClick={async () => {
            if (spots.some((s) => !s.handle))
              return notify.error(new Error("SPOT_WITHOUT_PRODUCT"));
            setBusy(true);
            const built = {
              ...draft,
              hotspots: spots.map((s, i) => ({
                handle: s.handle,
                key: s.key || `punkt-${i + 1}`,
                label: {
                  de: s.label.de.trim(),
                  ...(s.label.en.trim() ? { en: s.label.en.trim() } : {}),
                },
                x: s.x,
                y: s.y,
              })) as unknown as Json,
            };
            const { value: next, translation } = await translateBlock(base, built, LOOK_FIELDS);
            setDraft(next);
            const value = clean(next);
            if (await save("home.look", value, translation)) setBase(value);
            setBusy(false);
          }}
        >
          Speichern
        </Button>
      </div>
    </Panel>
  );
}
