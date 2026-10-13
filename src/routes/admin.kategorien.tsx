// Kategorien (Anzüge, Sakkos, Accessoires …): Namen DE/EN, Beschreibung, Bild für die Startseite, Reihenfolge.
import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteCategory,
  listCategories,
  saveCategory,
  translateTexts,
  uploadSiteImage,
  type Category,
} from "@/lib/admin/api";
import { autoList, autoTranslate, type AutoTranslateResult } from "@/lib/admin/auto-translate";
import { slugify } from "@/lib/admin/slug";
import { imageUrl } from "@/lib/commerce/mapping";
import { invalidateCatalog } from "@/lib/commerce/source";
import {
  AreaField,
  Badge,
  Bilingual,
  CheckField,
  ConfirmButton,
  ErrorBox,
  Loading,
  notify,
  PageHeader,
  TextField,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/kategorien")({
  component: Categories,
});

type Draft = {
  id?: string;
  slug: string;
  name_de: string;
  name_en: string;
  description_de: string;
  description_en: string;
  image_path: string;
  sort: string;
  active: boolean;
  /** Felder mit maschinellem Englisch (Spalte en_auto) */
  en_auto: string[];
};

const toDraft = (c: Category | null, nextSort: number): Draft => ({
  ...(c ? { id: c.id } : {}),
  slug: c?.slug ?? "",
  name_de: c?.name_de ?? "",
  name_en: c?.name_en ?? "",
  description_de: c?.description_de ?? "",
  description_en: c?.description_en ?? "",
  image_path: c?.image_path ?? "",
  sort: String(c?.sort ?? nextSort),
  active: c?.active ?? true,
  en_auto: c?.en_auto ?? [],
});

function Categories() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "categories"], queryFn: listCategories });
  const [draft, setDraft] = useState<Draft | null>(null);
  const refresh = () => {
    invalidateCatalog();
    void queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
  };
  const nextSort = Math.max(0, ...(query.data ?? []).map((c) => c.sort)) + 10;

  return (
    <>
      <PageHeader
        title="Kategorien"
        description="Erscheinen im Menü und als Kacheln auf der Startseite. «Alle», «Neu» und «Sale» entstehen automatisch."
        actions={
          <Button variant="admin" onClick={() => setDraft(toDraft(null, nextSort))}>
            <Plus /> Neue Kategorie
          </Button>
        }
      />
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorBox error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Bild</th>
                <th>Name</th>
                <th>Adresse</th>
                <th className="num">Reihenfolge</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(query.data ?? []).map((c) => {
                const src = imageUrl(c.image_path, "site-media");
                return (
                  <tr key={c.id}>
                    <td>
                      {src ? (
                        <img className="admin-thumb-img" src={src} alt="" />
                      ) : (
                        <span className="admin-thumb" />
                      )}
                    </td>
                    <td>
                      {c.name_de}
                      {c.name_en && <span className="admin-sub">{c.name_en}</span>}
                    </td>
                    <td>/kollektion/{c.slug}</td>
                    <td className="num">{c.sort}</td>
                    <td>
                      {c.active ? (
                        <Badge tone="ok">Aktiv</Badge>
                      ) : (
                        <Badge tone="muted">Ausgeblendet</Badge>
                      )}
                    </td>
                    <td className="admin-row-actions">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDraft(toDraft(c, nextSort))}
                      >
                        Bearbeiten
                      </Button>
                      <ConfirmButton
                        label="Löschen"
                        variant="ghost"
                        title={`Kategorie «${c.name_de}» löschen?`}
                        description="Geht nur, wenn keine Produkte mehr in dieser Kategorie sind. Sonst die Produkte zuerst verschieben oder die Kategorie ausblenden."
                        confirmLabel="Löschen"
                        onConfirm={async () => {
                          await deleteCategory(c.id);
                          notify.ok("Kategorie gelöscht.");
                          refresh();
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {draft && <CategoryDialog draft={draft} onClose={() => setDraft(null)} onSaved={refresh} />}
    </>
  );
}

function CategoryDialog({
  draft,
  onClose,
  onSaved,
}: {
  draft: Draft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [slugTouched, setSlugTouched] = useState(Boolean(draft.id));
  const file = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const src = imageUrl(form.image_path, "site-media");

  async function save() {
    setError("");
    if (!form.name_de.trim()) return setError("Bitte einen Namen angeben.");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.slug) || ["alle", "neu", "sale"].includes(form.slug))
      return setError(
        "Adresse: nur Kleinbuchstaben, Zahlen und Bindestriche (nicht «alle», «neu» oder «sale»).",
      );
    setBusy(true);
    try {
      const pairs = (d: Draft) => ({
        name: { de: d.name_de, en: d.name_en, auto: d.en_auto.includes("name") },
        description: {
          de: d.description_de,
          en: d.description_en,
          auto: d.en_auto.includes("description"),
        },
      });
      const translation: AutoTranslateResult = {
        ...(await autoTranslate(pairs(draft), pairs(form), translateTexts, {
          name: 80,
          description: 500,
        })),
        labels: { name: "Name", description: "Beschreibung" },
      };
      const f = {
        ...form,
        name_en: translation.pairs["name"]!.en,
        description_en: translation.pairs["description"]!.en,
        en_auto: autoList(translation.pairs),
      };
      await saveCategory({
        ...(f.id ? { id: f.id } : {}),
        slug: f.slug,
        name_de: f.name_de.trim(),
        name_en: f.name_en.trim() || null,
        description_de: f.description_de.trim() || null,
        description_en: f.description_en.trim() || null,
        image_path: f.image_path || null,
        sort: Number(f.sort) || 0,
        active: f.active,
        en_auto: f.en_auto,
      });
      notify.saved("Kategorie gespeichert.", translation);
      onSaved();
      onClose();
    } catch (e) {
      notify.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="admin-dialog admin-dialog-wide">
        <DialogHeader>
          <DialogTitle>{form.id ? `Kategorie «${draft.name_de}»` : "Neue Kategorie"}</DialogTitle>
        </DialogHeader>
        <fieldset className="admin-lock admin-form" disabled={busy}>
          <Bilingual
            de={
              <TextField
                label="Name"
                maxLength={80}
                value={form.name_de}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({
                    ...f,
                    name_de: name,
                    ...(slugTouched ? {} : { slug: slugify(name) }),
                  }));
                }}
              />
            }
            en={
              <TextField
                label="Name"
                maxLength={80}
                value={form.name_en}
                onChange={(e) => set("name_en", e.target.value)}
              />
            }
          />
          <Bilingual
            de={
              <AreaField
                label="Beschreibung"
                rows={3}
                maxLength={500}
                value={form.description_de}
                onChange={(e) => set("description_de", e.target.value)}
              />
            }
            en={
              <AreaField
                label="Description"
                rows={3}
                maxLength={500}
                value={form.description_en}
                onChange={(e) => set("description_en", e.target.value)}
              />
            }
          />
          <div className="admin-grid-2">
            <TextField
              label="Adresse"
              hint={`/kollektion/${form.slug || "…"}${draft.id && form.slug !== draft.slug ? " · Achtung: alte Links führen danach ins Leere" : ""}`}
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value.toLowerCase());
              }}
            />
            <TextField
              label="Reihenfolge"
              inputMode="numeric"
              value={form.sort}
              onChange={(e) => set("sort", e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
          <div className="admin-image-field">
            {src ? <img src={src} alt="" /> : <span className="admin-thumb" />}
            <div>
              <p className="admin-hint">Bild für die Kachel auf der Startseite (Hochformat 4:5).</p>
              <input
                ref={file}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const image = await uploadSiteImage(f, "kategorien");
                    set("image_path", image.path);
                  } catch (err) {
                    notify.error(err);
                  }
                }}
              />
              <Button variant="outline" size="sm" onClick={() => file.current?.click()}>
                <Upload /> Bild wählen
              </Button>
            </div>
          </div>
          <CheckField
            label="Im Shop zeigen"
            checked={form.active}
            onChange={(v) => set("active", v)}
          />
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
        </fieldset>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="admin" disabled={busy} onClick={() => void save()}>
            {busy ? "Wird gespeichert …" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
