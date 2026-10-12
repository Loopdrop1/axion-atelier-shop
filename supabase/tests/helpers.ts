import pg from "pg";
import { randomUUID } from "node:crypto";

export const DB_URL = process.env["AXION_DB_URL"] ?? "postgres://postgres@127.0.0.1:54329/axion";

export const pool = new pg.Pool({ connectionString: DB_URL, max: 12 });

export type Role = "anon" | "authenticated" | "service_role";

export interface Claims {
  sub?: string;
  email?: string;
}

export interface RoleOptions {
  /** Simulierte Anfrage-Header, z. B. für Rate-Limits nach IP. */
  headers?: Record<string, string>;
}

/**
 * Führt fn in einer Transaktion mit der Rolle und den JWT-Claims aus, so wie PostgREST es tut.
 * Fehler rollen zurück und werden weitergereicht.
 */
export async function withRole<T>(
  role: Role,
  claims: Claims | null,
  fn: (c: pg.PoolClient) => Promise<T>,
  opts: RoleOptions = {},
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('role', $1, true)", [role]);
    await c.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ role, ...(claims ?? {}) }),
    ]);
    await c.query("select set_config('request.headers', $1, true)", [
      JSON.stringify(opts.headers ?? {}),
    ]);
    const result = await fn(c);
    await c.query("commit");
    return result;
  } catch (error) {
    await c.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    c.release();
  }
}

/** Kurzform für eine einzelne Abfrage mit Rolle. */
export async function q<T = Record<string, unknown>>(
  role: Role,
  claims: Claims | null,
  sql: string,
  params: unknown[] = [],
  opts: RoleOptions = {},
): Promise<T[]> {
  return withRole(role, claims, async (c) => (await c.query(sql, params)).rows as T[], opts);
}

/** Abfrage als Superuser (Testvorbereitung, Kontrolle). */
export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await pool.query(text, params)).rows as T[];
}

export function uniq(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export interface TestUser {
  id: string;
  email: string;
  claims: Claims;
}

/** Legt einen Benutzer in auth.users an, optional mit bestätigter E-Mail und Admin-Rolle. */
export async function createUser(
  email = `${uniq("user")}@example.ch`,
  opts: { confirmed?: boolean; admin?: boolean; locale?: "de" | "en" } = {},
): Promise<TestUser> {
  const rows = await sql<{ id: string }>(
    `insert into auth.users (email, email_confirmed_at, raw_user_meta_data)
     values ($1, $2, $3) returning id`,
    [
      email,
      opts.confirmed === false ? null : new Date().toISOString(),
      JSON.stringify({ locale: opts.locale ?? "de" }),
    ],
  );
  const id = rows[0]!.id;
  if (opts.admin)
    await sql("insert into public.user_roles (user_id, role) values ($1, 'admin')", [id]);
  return { id, email, claims: { sub: id, email } };
}

/** Erwartet einen Postgres-Fehler und gibt Meldung und Detail zurück. */
export async function expectPgError(
  promise: Promise<unknown>,
): Promise<{ message: string; detail?: string | undefined; code?: string | undefined }> {
  try {
    await promise;
  } catch (error) {
    const e = error as { message: string; detail?: string; code?: string };
    return { message: e.message, detail: e.detail, code: e.code };
  }
  throw new Error("Es wurde ein Datenbankfehler erwartet, aber die Abfrage war erfolgreich.");
}
