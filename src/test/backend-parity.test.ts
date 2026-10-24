// Paritätstests fürs Backend (laufen ohne Datenbank):
// 1. Jede Edge Function hat in supabase/config.toml einen Abschnitt mit verify_jwt = false (Lovable hat ihn schon einmal entfernt).
// 2. supabase/migrations (lokale Testdatenbank) und drizzle/migrations (läuft in Cloud) enthalten dieselben Anweisungen;
//    erlaubt sind nur die bekannten Unterschiede: citext → text mit lower()-Index, Bucket-INSERT und die citext-Erweiterung.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Edge Functions: verify_jwt", () => {
  const functions = readdirSync(resolve(root, "supabase/functions"), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort();
  const config = read("supabase/config.toml");

  it("findet die Funktionen", () => {
    expect(functions.length).toBeGreaterThanOrEqual(9);
  });

  it.each(functions)("%s: [functions.%s] verify_jwt = false", (name) => {
    const block = new RegExp(
      `^\\[functions\\.${name.replace(/-/g, "\\-")}\\]\\s*\\n(?:[^\\[\\n]*\\n)*?\\s*verify_jwt\\s*=\\s*false\\b`,
      "m",
    );
    expect(
      config,
      `supabase/config.toml: Abschnitt für ${name} fehlt oder ohne verify_jwt = false`,
    ).toMatch(block);
  });

  it("jeder Abschnitt gehört zu einer vorhandenen Funktion", () => {
    const declared = [...config.matchAll(/^\[functions\.([a-z0-9-]+)\]/gm)].map((m) => m[1]!);
    for (const name of declared) expect(functions).toContain(name);
  });
});

/** Zerlegt SQL in Anweisungen (Kommentare weg, `$$`-Blöcke und Strings bleiben ganz) und normalisiert Leerraum. */
function statements(sql: string): string[] {
  const out: string[] = [];
  let current = "";
  let i = 0;
  let dollar: string | null = null;
  let quote = false;
  while (i < sql.length) {
    const rest = sql.slice(i);
    if (dollar) {
      if (rest.startsWith(dollar)) {
        current += dollar;
        i += dollar.length;
        dollar = null;
      } else current += sql[i++];
      continue;
    }
    if (quote) {
      current += sql[i];
      if (sql[i] === "'") quote = false;
      i++;
      continue;
    }
    if (rest.startsWith("--")) {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end;
      continue;
    }
    const tag = /^\$[A-Za-z_]*\$/.exec(rest);
    if (tag) {
      dollar = tag[0];
      current += tag[0];
      i += tag[0].length;
      continue;
    }
    if (sql[i] === "'") quote = true;
    if (sql[i] === ";") {
      out.push(current);
      current = "";
      i++;
      continue;
    }
    current += sql[i++];
  }
  if (current.trim()) out.push(current);
  return out
    .map((s) =>
      s
        .replace(/\s+/g, " ")
        .replace(/\s*([(),])\s*/g, "$1")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
}

/** Erste Wörter einer Anweisung: genügt, um «dieselbe Tabelle» zu erkennen, wenn der Rumpf wegen citext abweicht. */
const head = (s: string) => s.split(" ").slice(0, 5).join(" ");

const supabaseDir = "supabase/migrations";
const drizzleDir = "drizzle/migrations";
// Datei in drizzle → Name in supabase (nur wo er abweicht)
const ALIAS: Record<string, string> = { storage_policies: "storage" };

function pairs(): { name: string; supabase: string; drizzle: string }[] {
  const sFiles = readdirSync(resolve(root, supabaseDir)).filter((f) => f.endsWith(".sql"));
  const dFiles = readdirSync(resolve(root, drizzleDir)).filter((f) => f.endsWith(".sql"));
  return dFiles.map((d) => {
    const raw = d.replace(/^\d{4}_axion_/, "").replace(/\.sql$/, "");
    const name = ALIAS[raw] ?? raw;
    const s = sFiles.find((f) => f.replace(/^\d{14}_/, "").replace(/\.sql$/, "") === name);
    return { name: raw, supabase: s ? `${supabaseDir}/${s}` : "", drizzle: `${drizzleDir}/${d}` };
  });
}

describe("Migrationen: supabase/migrations und drizzle/migrations", () => {
  const all = pairs();

  it("jede drizzle-Migration hat ihr Gegenstück und umgekehrt", () => {
    expect(all.filter((p) => !p.supabase).map((p) => p.name)).toEqual([]);
    const used = new Set(all.map((p) => p.supabase));
    const unused = readdirSync(resolve(root, supabaseDir))
      .filter((f) => f.endsWith(".sql"))
      .filter((f) => !used.has(`${supabaseDir}/${f}`));
    expect(unused).toEqual([]);
  });

  it("das Journal führt jede drizzle-Datei in der richtigen Reihenfolge", () => {
    const journal = JSON.parse(read(`${drizzleDir}/meta/_journal.json`)) as {
      entries: { idx: number; tag: string; when: number }[];
    };
    const files = readdirSync(resolve(root, drizzleDir))
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.replace(/\.sql$/, ""))
      .sort();
    expect(journal.entries.map((e) => e.tag)).toEqual(files);
    journal.entries.forEach((e, i) => {
      expect(e.idx).toBe(i);
      if (i > 0) expect(e.when).toBeGreaterThan(journal.entries[i - 1]!.when);
    });
    for (const f of files) expect(existsSync(resolve(root, drizzleDir, `${f}.sql`))).toBe(true);
  });

  it.each(all.filter((p) => p.supabase).map((p) => [p.name, p] as const))(
    "%s: gleiche Anweisungen (bis auf citext, lower()-Index und Bucket-INSERT)",
    (_name, p) => {
      const s = statements(read(p.supabase)).filter(
        (x) =>
          !/^create extension if not exists citext\b/.test(x) &&
          !/^insert into storage\.buckets\b/.test(x),
      );
      const d = statements(read(p.drizzle)).filter(
        // Ersatz für «unique» auf citext-Spalten
        (x) => !/^create unique index \w+_lower_idx on /.test(x),
      );
      expect(d).toHaveLength(s.length);
      s.forEach((stmt, i) => {
        if (stmt.includes("citext")) expect(head(d[i]!)).toBe(head(stmt));
        else expect(d[i]).toBe(stmt);
      });
    },
  );
});
