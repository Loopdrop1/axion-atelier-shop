// Grössentabellen pflegen (site_content «size_guides»). Sie erscheinen auf den Produktseiten der gewählten
// Kategorien und auf der Seite «Grössenberatung». Englisch wird beim Speichern automatisch übersetzt; «auto» bei
// einem Text heisst: Das Englisch stammt aus der Übersetzung und folgt dem Deutschen.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getContent,
  listCategories,
  saveContent,
  translateTexts,
  type Category,
} from "@/lib/admin/api";
import { autoTranslate, type AutoTranslateResult, type Pairs } from "@/lib/admin/auto-translate";
import { newId } from "@/lib/admin/content-translate";
import type { Json } from "@/integrations/supabase/types";
import { invalidateCatalog } from "@/lib/commerce/source";
import { useSession } from "@/lib/account/session";
import {
  Bilingual,
  CheckField,
  ConfirmButton,
  ErrorBox,
  Loading,
  notify,
  PageHeader,
  Panel,
  TextField,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/groessen")({
  component: SizeGuidesPage,
});

interface Text {
  de: string;
  en: string;
  auto?: boolean;
}
/** Spalte mit ID (nur während der Bearbeitung): Englisch bleibt beim Löschen einer Spalte bei der richtigen. */
interface Column extends Text {
  id: string;
}
interface Table {
  id: string;
  title: Text;
  categories: string[];
  columns: Column[];
  rows: string[][];
  note: Text;
}

const KEY = "size_guides";
const empty = (): Text => ({ de: "", en: "" });
const column = (de = ""): Column => ({ id: newId(), de, en: "" });

const TEMPLATES: Record<string, { label: string; make: () => Omit<Table, "id"> }> = {
  anzug: {
    label: "Anzüge und Westen",
    make: () => ({
      title: { de: "Anzüge und Westen", en: "" },
      categories: [],
      columns: [
        "Grösse",
        "Brust (cm)",
        "Taille (cm)",
        "Hüfte (cm)",
        "Schulter (cm)",
        "Ärmel (cm)",
        "Innenbein (cm)",
      ].map((de) => column(de)),
      rows: ["46", "48", "50", "52", "54", "56"].map((size) => [size, "", "", "", "", "", ""]),
      note: { de: "Körpermasse in Zentimetern.", en: "" },
    }),
  },
  schuhe: {
    label: "Schuhe",
    make: () => ({
      title: { de: "Schuhe", en: "" },
      categories: [],
      columns: ["EU-Grösse", "Fusslänge (cm)"].map((de) => column(de)),
      rows: ["40", "41", "42", "43", "44", "45", "46"].map((size) => [size, ""]),
      note: { de: "Fusslänge von der Ferse bis zum längsten Zeh.", en: "" },
    }),
  },
  leer: {
    label: "Leere Tabelle",
    make: () => ({
      title: empty(),
      categories: [],
      columns: [column("Grösse"), column()],
      rows: [["", ""]],
      note: empty(),
    }),
  },
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const text = (v: unknown): Text =>
  isObj(v) ? { de: str(v["de"]), en: str(v["en"]), auto: v["auto"] === true } : empty();

function readTables(value: Json | undefined): Table[] {
  const tables: unknown[] = isObj(value) && Array.isArray(value["tables"]) ? value["tables"] : [];
  return tables.filter(isObj).map((t) => {
    const columns = (Array.isArray(t["columns"]) ? t["columns"] : []).map((c) => ({
      ...text(c),
      id: newId(),
    }));
    return {
      id: str(t["id"]) || newId(),
      title: text(t["title"]),
      categories: (Array.isArray(t["categories"]) ? t["categories"] : []).filter(
        (c): c is string => typeof c === "string",
      ),
      columns,
      rows: (Array.isArray(t["rows"]) ? t["rows"] : []).map((r) =>
        columns.map((_, i) => (Array.isArray(r) ? str(r[i]) : "")),
      ),
      note: text(t["note"]),
    };
  });
}

/** Englische Texte (Titel, Spalten, Hinweis) als Paare für die automatische Übersetzung. */
function pairsOf(tables: Table[]): Pairs {
  const pairs: Pairs = {};
  const pair = (t: Text) => ({ de: t.de, en: t.en, auto: Boolean(t.auto) });
  for (const t of tables) {
    pairs[`${t.id}:title`] = pair(t.title);
    pairs[`${t.id}:note`] = pair(t.note);
    for (const c of t.columns) pairs[`${t.id}:col:${c.id}`] = pair(c);
  }
  return pairs;
}

/** Bezeichnungen für den Hinweis «Englisch prüfen» */
function labelsOf(tables: Table[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const t of tables) {
    const name = t.title.de.trim() || "ohne Titel";
    labels[`${t.id}:title`] = `Titel «${name}»`;
    labels[`${t.id}:note`] = `Hinweis «${name}»`;
    for (const c of t.columns)
      labels[`${t.id}:col:${c.id}`] = `Spalte «${c.de.trim()}» in «${name}»`;
  }
  return labels;
}

function withPairs(tables: Table[], pairs: Pairs): Table[] {
  const en = <T extends Text>(key: string, current: T): T => {
    const pair = pairs[key];
    return pair ? { ...current, en: pair.en, auto: Boolean(pair.auto) } : current;
  };
  return tables.map((t) => ({
    ...t,
    title: en(`${t.id}:title`, t.title),
    note: en(`${t.id}:note`, t.note),
    columns: t.columns.map((c) => en(`${t.id}:col:${c.id}`, c)),
  }));
}

function toJson(tables: Table[]): Json {
  const clean = (t: Text) => ({
    de: t.de.trim(),
    ...(t.en.trim() ? { en: t.en.trim() } : {}),
    ...(t.auto && t.en.trim() ? { auto: true } : {}),
  });
  return {
    tables: tables.map((t) => ({
      id: t.id,
      title: clean(t.title),
      categories: t.categories,
      columns: t.columns.map(clean),
      rows: t.rows.map((r) => r.map((cell) => cell.trim())),
      note: clean(t.note),
    })),
  };
}

function SizeGuidesPage() {
  const content = useQuery({ queryKey: ["admin", "content"], queryFn: getContent });
  const categories = useQuery({ queryKey: ["admin", "categories"], queryFn: listCategories });
  if (content.isLoading || categories.isLoading) return <Loading />;
  if (content.isError || categories.isError)
    return <ErrorBox error={content.error ?? categories.error} />;
  return <Editor initial={readTables(content.data?.[KEY])} categories={categories.data ?? []} />;
}

function Editor({ initial, categories }: { initial: Table[]; categories: Category[] }) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [tables, setTables] = useState(initial);
  const [base, setBase] = useState(initial);
  const [busy, setBusy] = useState(false);
  const update = (id: string, change: (t: Table) => Table) =>
    setTables((list) => list.map((t) => (t.id === id ? change(t) : t)));

  async function save() {
    setBusy(true);
    try {
      const translation: AutoTranslateResult = {
        ...(await autoTranslate(pairsOf(base), pairsOf(tables), translateTexts)),
        labels: labelsOf(tables),
      };
      const next = withPairs(tables, translation.pairs);
      await saveContent(KEY, toJson(next), user!.id);
      // Erst nach dem Speichern übernehmen (sonst gälte maschinelles Englisch danach als eigenes)
      setTables(next);
      setBase(next);
      invalidateCatalog();
      void queryClient.invalidateQueries({ queryKey: ["admin", "content"] });
      notify.saved(
        "Gespeichert. Im Shop sichtbar nach dem nächsten Laden der Seite (spätestens nach 30 Sekunden).",
        translation,
      );
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Grössentabellen"
        description="Erscheinen auf den Produktseiten der gewählten Kategorien und auf der Seite «Grössenberatung». Leere Zeilen erscheinen nicht. Englisch wird beim Speichern automatisch übersetzt."
        actions={Object.entries(TEMPLATES).map(([key, tpl]) => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setTables((list) => [...list, { id: newId(), ...tpl.make() }])}
          >
            <Plus /> {tpl.label}
          </Button>
        ))}
      />
      {tables.length === 0 && (
        <p className="admin-empty">
          Noch keine Grössentabelle. Oben eine Vorlage wählen, Masse eintragen und speichern.
        </p>
      )}
      <fieldset className="admin-lock" disabled={busy}>
        {tables.map((t) => (
          <Panel
            key={t.id}
            title={t.title.de || "Neue Tabelle"}
            actions={
              <ConfirmButton
                label={
                  <>
                    <Trash2 /> Tabelle entfernen
                  </>
                }
                title={`Tabelle «${t.title.de || "ohne Titel"}» entfernen?`}
                description="Sie verschwindet nach dem Speichern aus dem Shop."
                confirmLabel="Entfernen"
                onConfirm={async () => setTables((list) => list.filter((x) => x.id !== t.id))}
              />
            }
          >
            <div className="admin-form">
              <Bilingual
                de={
                  <TextField
                    label="Titel"
                    maxLength={80}
                    value={t.title.de}
                    onChange={(e) =>
                      update(t.id, (x) => ({ ...x, title: { ...x.title, de: e.target.value } }))
                    }
                  />
                }
                en={
                  <TextField
                    label="Title"
                    maxLength={80}
                    value={t.title.en}
                    onChange={(e) =>
                      update(t.id, (x) => ({ ...x, title: { ...x.title, en: e.target.value } }))
                    }
                  />
                }
              />
              <fieldset className="admin-fieldset">
                <legend>Gilt für (keine Auswahl = alle Kategorien)</legend>
                <div className="admin-checks">
                  {categories.map((c) => (
                    <CheckField
                      key={c.id}
                      label={c.name_de}
                      checked={t.categories.includes(c.slug)}
                      onChange={(v) =>
                        update(t.id, (x) => ({
                          ...x,
                          categories: v
                            ? [...x.categories, c.slug]
                            : x.categories.filter((s) => s !== c.slug),
                        }))
                      }
                    />
                  ))}
                </div>
              </fieldset>
              <div className="table-scroll">
                <table className="admin-size-grid">
                  <thead>
                    <tr>
                      {t.columns.map((col, i) => (
                        <th key={col.id}>
                          <input
                            aria-label={`Spalte ${i + 1} (Deutsch)`}
                            value={col.de}
                            maxLength={40}
                            onChange={(e) =>
                              update(t.id, (x) => ({
                                ...x,
                                columns: x.columns.map((c, k) =>
                                  k === i ? { ...c, de: e.target.value } : c,
                                ),
                              }))
                            }
                          />
                          <input
                            className="admin-size-en"
                            aria-label={`Spalte ${i + 1} (Englisch)`}
                            placeholder="English"
                            value={col.en}
                            maxLength={40}
                            onChange={(e) =>
                              update(t.id, (x) => ({
                                ...x,
                                columns: x.columns.map((c, k) =>
                                  k === i ? { ...c, en: e.target.value } : c,
                                ),
                              }))
                            }
                          />
                          {t.columns.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Spalte ${i + 1} entfernen`}
                              onClick={() =>
                                update(t.id, (x) => ({
                                  ...x,
                                  columns: x.columns.filter((_, k) => k !== i),
                                  rows: x.rows.map((r) => r.filter((_, k) => k !== i)),
                                }))
                              }
                            >
                              <Trash2 />
                            </Button>
                          )}
                        </th>
                      ))}
                      <th aria-hidden="true" />
                    </tr>
                  </thead>
                  <tbody>
                    {t.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, i) => (
                          <td key={i}>
                            <input
                              aria-label={`Zeile ${r + 1}, ${t.columns[i]?.de || `Spalte ${i + 1}`}`}
                              value={cell}
                              maxLength={30}
                              onChange={(e) =>
                                update(t.id, (x) => ({
                                  ...x,
                                  rows: x.rows.map((rr, k) =>
                                    k === r
                                      ? rr.map((cc, j) => (j === i ? e.target.value : cc))
                                      : rr,
                                  ),
                                }))
                              }
                            />
                          </td>
                        ))}
                        <td>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Zeile ${r + 1} entfernen`}
                            onClick={() =>
                              update(t.id, (x) => ({
                                ...x,
                                rows: x.rows.filter((_, k) => k !== r),
                              }))
                            }
                          >
                            <Trash2 />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="admin-actions">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={t.rows.length >= 40}
                  onClick={() =>
                    update(t.id, (x) => ({ ...x, rows: [...x.rows, x.columns.map(() => "")] }))
                  }
                >
                  <Plus /> Zeile
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={t.columns.length >= 10}
                  onClick={() =>
                    update(t.id, (x) => ({
                      ...x,
                      columns: [...x.columns, column()],
                      rows: x.rows.map((r) => [...r, ""]),
                    }))
                  }
                >
                  <Plus /> Spalte
                </Button>
              </div>
              <Bilingual
                de={
                  <TextField
                    label="Hinweis unter der Tabelle (freiwillig)"
                    maxLength={300}
                    value={t.note.de}
                    onChange={(e) =>
                      update(t.id, (x) => ({ ...x, note: { ...x.note, de: e.target.value } }))
                    }
                  />
                }
                en={
                  <TextField
                    label="Note below the table"
                    maxLength={300}
                    value={t.note.en}
                    onChange={(e) =>
                      update(t.id, (x) => ({ ...x, note: { ...x.note, en: e.target.value } }))
                    }
                  />
                }
              />
            </div>
          </Panel>
        ))}
      </fieldset>
      <div className="admin-savebar">
        <Button variant="admin" disabled={busy} onClick={() => void save()}>
          {busy ? "Wird gespeichert …" : "Grössentabellen speichern"}
        </Button>
      </div>
    </>
  );
}
