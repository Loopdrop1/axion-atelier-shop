import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUser, expectPgError, pool, q, sql, type TestUser } from "./helpers";

let admin: TestUser;
let customer: TestUser;

beforeAll(async () => {
  admin = await createUser(undefined, { admin: true });
  customer = await createUser();
});

afterAll(async () => {
  await pool.end();
});

const insert = "insert into storage.objects (bucket_id, name) values ($1, $2) returning id";

describe("Speicher", () => {
  it("die zwei Buckets sind öffentlich und auf Bilder bis 8 MB beschränkt", async () => {
    const rows = await sql<{ id: string; public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      "select id, public, file_size_limit::text, allowed_mime_types from storage.buckets where id in ('product-images', 'site-media') order by id",
    );
    expect(rows.map((r) => [r.id, r.public, r.file_size_limit])).toEqual([
      ["product-images", true, "8388608"],
      ["site-media", true, "8388608"],
    ]);
    expect(rows[0]!.allowed_mime_types).toContain("image/webp");
  });

  it("anon und Kundschaft dürfen nicht hochladen", async () => {
    const anon = await expectPgError(q("anon", null, insert, ["product-images", "x/anon.webp"]));
    expect(anon.message).toMatch(/row-level security/);
    const cust = await expectPgError(q("authenticated", customer.claims, insert, ["product-images", "x/kunde.webp"]));
    expect(cust.message).toMatch(/row-level security/);
  });

  it("Admin lädt hoch, ersetzt und löscht", async () => {
    const rows = await q<{ id: string }>("authenticated", admin.claims, insert, ["product-images", "test/admin.webp"]);
    expect(rows).toHaveLength(1);
    const upd = await q("authenticated", admin.claims, "update storage.objects set metadata = '{\"v\":2}' where name = 'test/admin.webp' returning id");
    expect(upd).toHaveLength(1);
    const del = await q("authenticated", admin.claims, "delete from storage.objects where name = 'test/admin.webp' returning id");
    expect(del).toHaveLength(1);
  });

  it("Admin kann nicht in fremde Buckets schreiben", async () => {
    await sql("insert into storage.buckets (id, name, public) values ('privat', 'privat', false) on conflict do nothing");
    const err = await expectPgError(q("authenticated", admin.claims, insert, ["privat", "geheim.txt"]));
    expect(err.message).toMatch(/row-level security/);
  });
});
