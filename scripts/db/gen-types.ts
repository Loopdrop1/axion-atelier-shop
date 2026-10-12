// Erzeugt src/integrations/supabase/types.ts aus der lokalen Datenbank im Format von «supabase gen types».
// Aufruf: bun scripts/db/gen-types.ts   (vorher: scripts/db/local-db.sh reset)
// Sobald das echte Supabase-Projekt existiert, kann die Datei auch mit dem Supabase-CLI oder -MCP erzeugt werden.
import pg from "pg";
import { writeFileSync } from "node:fs";
import * as prettier from "prettier";
import path from "node:path";

const DB_URL = process.env["AXION_DB_URL"] ?? "postgres://postgres@127.0.0.1:54329/axion";
const OUT = path.resolve(import.meta.dirname, "../../src/integrations/supabase/types.ts");

const client = new pg.Client({ connectionString: DB_URL });
await client.connect();

type Col = {
  table: string;
  column: string;
  udt: string;
  udt_schema: string;
  data_type: string;
  nullable: boolean;
  has_default: boolean;
  identity: boolean;
  ordinal: number;
};
const cols = (
  await client.query<Col>(`
    select c.table_name as table, c.column_name as column, c.udt_name as udt, c.udt_schema, c.data_type,
      c.is_nullable = 'YES' as nullable, c.column_default is not null as has_default,
      c.is_identity = 'YES' or c.is_generated = 'ALWAYS' as identity, c.ordinal_position as ordinal
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
    order by c.table_name, c.ordinal_position`)
).rows;

const enums = (
  await client.query<{ name: string; values: string[] }>(`
    select t.typname as name, array_agg(e.enumlabel::text order by e.enumsortorder) as values
    from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' group by t.typname order by t.typname`)
).rows;
const enumNames = new Set(enums.map((e) => e.name));

const rels = (
  await client.query<{
    table: string;
    name: string;
    columns: string[];
    ref_table: string;
    ref_columns: string[];
    one_to_one: boolean;
  }>(`
    select cl.relname as table, con.conname as name,
      array(select a.attname::text from unnest(con.conkey) k join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k) as columns,
      rcl.relname as ref_table,
      array(select a.attname::text from unnest(con.confkey) k join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k) as ref_columns,
      exists (select 1 from pg_index i where i.indrelid = con.conrelid and i.indisunique and i.indkey::int2[] @> con.conkey and cardinality(i.indkey::int2[]) = cardinality(con.conkey)) as one_to_one
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid join pg_namespace n on n.oid = cl.relnamespace
    join pg_class rcl on rcl.oid = con.confrelid join pg_namespace rn on rn.oid = rcl.relnamespace
    where con.contype = 'f' and n.nspname = 'public' and rn.nspname = 'public'
    order by cl.relname, con.conname`)
).rows;

type Fn = {
  name: string;
  arg_names: string[] | null;
  arg_types: string[];
  arg_modes: string[] | null;
  n_defaults: number;
  ret: string;
  ret_set: boolean;
  table_cols: { name: string; type: string }[] | null;
};
const fns = (
  await client.query<Fn>(`
    select p.proname as name, p.proargnames as arg_names,
      array(select format_type(t, null) from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) t) as arg_types,
      p.proargmodes::text[] as arg_modes, p.pronargdefaults as n_defaults,
      format_type(p.prorettype, null) as ret, p.proretset as ret_set, null as table_cols
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
        or has_function_privilege('service_role', p.oid, 'execute'))
      and p.proname not like 'pg\\_%'
    order by p.proname`)
).rows;

function tsType(pgType: string): string {
  const t = pgType.replace(/^public\./, "");
  if (t.endsWith("[]")) return `${tsType(t.slice(0, -2))}[]`;
  if (enumNames.has(t)) return `Database["public"]["Enums"]["${t}"]`;
  if (
    [
      "uuid",
      "text",
      "citext",
      "extensions.citext",
      "character varying",
      "timestamp with time zone",
      "date",
      "interval",
    ].includes(t)
  )
    return "string";
  if (
    [
      "integer",
      "bigint",
      "smallint",
      "numeric",
      "real",
      "double precision",
      "int4",
      "int8",
      "int2",
    ].includes(t)
  )
    return "number";
  if (["boolean", "bool"].includes(t)) return "boolean";
  if (["jsonb", "json"].includes(t)) return "Json";
  if (t === "void") return "undefined";
  return "unknown";
}

function colType(c: Col): string {
  if (c.data_type === "ARRAY") return `${tsType(c.udt.replace(/^_/, ""))}[]`;
  if (c.data_type === "USER-DEFINED" && enumNames.has(c.udt)) return tsType(c.udt);
  if (c.udt === "citext") return "string";
  const map: Record<string, string> = {
    uuid: "uuid",
    text: "text",
    int4: "integer",
    int8: "bigint",
    int2: "smallint",
    bool: "boolean",
    timestamptz: "timestamp with time zone",
    jsonb: "jsonb",
    json: "json",
    date: "date",
  };
  return tsType(map[c.udt] ?? c.udt);
}

const tables = [...new Set(cols.map((c) => c.table))];
const ind = (n: number) => " ".repeat(n);
let out = `// Automatisch erzeugt mit scripts/db/gen-types.ts aus den Migrationen. Nicht von Hand ändern.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13"
  }
  public: {
    Tables: {
`;
for (const table of tables) {
  const tc = cols.filter((c) => c.table === table);
  out += `${ind(6)}${table}: {\n`;
  out +=
    `${ind(8)}Row: {\n` +
    tc.map((c) => `${ind(10)}${c.column}: ${colType(c)}${c.nullable ? " | null" : ""}`).join("\n") +
    `\n${ind(8)}}\n`;
  out +=
    `${ind(8)}Insert: {\n` +
    tc
      .map(
        (c) =>
          `${ind(10)}${c.column}${c.nullable || c.has_default || c.identity ? "?" : ""}: ${colType(c)}${c.nullable ? " | null" : ""}`,
      )
      .join("\n") +
    `\n${ind(8)}}\n`;
  out +=
    `${ind(8)}Update: {\n` +
    tc
      .map((c) => `${ind(10)}${c.column}?: ${colType(c)}${c.nullable ? " | null" : ""}`)
      .join("\n") +
    `\n${ind(8)}}\n`;
  const tr = rels.filter((r) => r.table === table);
  out +=
    `${ind(8)}Relationships: [` +
    (tr.length
      ? "\n" +
        tr
          .map(
            (r) =>
              `${ind(10)}{\n${ind(12)}foreignKeyName: "${r.name}"\n${ind(12)}columns: [${r.columns.map((c) => `"${c}"`).join(", ")}]\n${ind(12)}isOneToOne: ${r.one_to_one}\n${ind(12)}referencedRelation: "${r.ref_table}"\n${ind(12)}referencedColumns: [${r.ref_columns.map((c) => `"${c}"`).join(", ")}]\n${ind(10)}},`,
          )
          .join("\n") +
        `\n${ind(8)}`
      : "") +
    "]\n";
  out += `${ind(6)}}\n`;
}
out += `${ind(4)}}\n${ind(4)}Views: {\n${ind(6)}[_ in never]: never\n${ind(4)}}\n${ind(4)}Functions: {\n`;
for (const f of fns) {
  const modes = f.arg_modes ?? f.arg_types.map(() => "i");
  const names = f.arg_names ?? [];
  const inArgs: { name: string; type: string; optional: boolean }[] = [];
  const outCols: { name: string; type: string }[] = [];
  const inputCount = modes.filter((m) => m === "i" || m === "b").length;
  let inputIndex = 0;
  modes.forEach((m, i) => {
    if (m === "i" || m === "b") {
      inArgs.push({
        name: names[i] ?? `arg${i}`,
        type: tsType(f.arg_types[i]!),
        optional: inputIndex >= inputCount - f.n_defaults,
      });
      inputIndex++;
    }
    if (m === "t" || m === "o")
      outCols.push({ name: names[i] ?? `col${i}`, type: tsType(f.arg_types[i]!) });
  });
  const args = inArgs.length
    ? `{ ${inArgs.map((a) => `${a.name}${a.optional ? "?" : ""}: ${a.type}`).join("; ")} }`
    : "Record<PropertyKey, never>";
  const ret = outCols.length
    ? `{ ${outCols.map((c) => `${c.name}: ${c.type}`).join("; ")} }[]`
    : tsType(f.ret) + (f.ret_set ? "[]" : "");
  out += `${ind(6)}${f.name}: {\n${ind(8)}Args: ${args}\n${ind(8)}Returns: ${ret}\n${ind(6)}}\n`;
}
out += `${ind(4)}}\n${ind(4)}Enums: {\n`;
for (const e of enums) out += `${ind(6)}${e.name}: ${e.values.map((v) => `"${v}"`).join(" | ")}\n`;
out += `${ind(4)}}\n${ind(4)}CompositeTypes: {\n${ind(6)}[_ in never]: never\n${ind(4)}}\n  }\n}\n\n`;
out += `type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
export type Functions<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T]

export const Constants = {
  public: {
    Enums: {
${enums.map((e) => `      ${e.name}: [${e.values.map((v) => `"${v}"`).join(", ")}],`).join("\n")}
    },
  },
} as const
`;
// Gleich formatieren wie der restliche Code (eslint prüft prettier).
writeFileSync(
  OUT,
  await prettier.format(out, { ...(await prettier.resolveConfig(OUT)), parser: "typescript" }),
);
await client.end();
console.log(
  `Typen geschrieben: ${path.relative(process.cwd(), OUT)} (${tables.length} Tabellen, ${fns.length} Funktionen, ${enums.length} Enums)`,
);
