// Admin im Browser: Zugang, Bestellungen, Produkte mit Bild, Lager, Rabattcodes, Gutscheine, Inhalte,
// Zugänge, Einstellungen, Exporte. Läuft gegen e2e/fake-supabase.ts (vor jedem Test zurückgesetzt).
import { readFile } from "node:fs/promises";
import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import { FIXTURES } from "./fake-supabase";

const FAKE = "http://127.0.0.1:54400";
// 1×1-Pixel-PNG als Testbild
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

interface LogEntry {
  path: string;
  body: Record<string, unknown>;
}

async function fakeLog(request: APIRequestContext): Promise<LogEntry[]> {
  return (await (await request.get(`${FAKE}/__log`)).json()) as LogEntry[];
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource"))
      errors.push(m.text());
  });
  return errors;
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator("html[data-hydrated]").waitFor({ state: "attached", timeout: 30_000 });
}

async function adminSignIn(page: Page, path = "/admin/anmelden") {
  await open(page, path);
  await page.getByLabel("E-Mail-Adresse").fill(FIXTURES.adminEmail);
  await page.getByLabel("Passwort").fill(FIXTURES.adminPassword);
  await page.getByRole("button", { name: "Anmelden" }).click();
}

async function shot(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: `.local/e2e-shots/${info.project.name}-admin-${name}.png` });
}

const toast = (page: Page, text: string | RegExp) =>
  expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();

test.beforeEach(async ({ request }) => {
  await request.post(`${FAKE}/__reset`);
});

test("Admin: Anmeldung nötig, Kundschaft ohne Rechte sieht «Kein Zugriff»", async ({ page }) => {
  await open(page, "/admin/bestellungen");
  await expect(page).toHaveURL(/\/admin\/anmelden\?weiter=%2Fadmin%2Fbestellungen$/);
  await page.getByLabel("E-Mail-Adresse").fill(FIXTURES.email);
  await page.getByLabel("Passwort").fill(FIXTURES.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Kein Zugriff" })).toBeVisible();
  await page.getByRole("button", { name: "Mit anderem Konto anmelden" }).click();
  await page.getByLabel("E-Mail-Adresse").fill(FIXTURES.adminEmail);
  await page.getByLabel("Passwort").fill(FIXTURES.adminPassword);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/admin\/bestellungen$/);
  await expect(page.getByRole("heading", { name: "Bestellungen" })).toBeVisible();
  await expect(page.locator("meta[name=robots]").first()).toHaveAttribute("content", /noindex/);
});

test("Admin: Übersicht, Bestellung versenden, interne Notiz, Retoure", async ({
  page,
  request,
}, info) => {
  const errors = watchErrors(page);
  await adminSignIn(page);
  await expect(page.getByRole("heading", { name: "Übersicht" })).toBeVisible();
  await expect(page.locator(".admin-stat", { hasText: "Zu versenden" })).toContainText("1");
  await shot(page, info, "uebersicht");

  await page.locator(".admin-stat", { hasText: "Zu versenden" }).click();
  await expect(page).toHaveURL(/ansicht=open/);
  await page.getByRole("link", { name: "AX-1040" }).click();
  await expect(page.getByRole("heading", { name: "Bestellung AX-1040" })).toBeVisible();
  await page.getByLabel("Sendungsnummer", { exact: true }).fill("99.00.111111.22222222");
  await page.getByRole("button", { name: "Als versendet markieren" }).click();
  await toast(page, "Als versendet markiert und E-Mail gesendet.");
  await expect(page.getByRole("link", { name: "99.00.111111.22222222" })).toHaveAttribute(
    "href",
    /post\.ch\/swisspost-tracking\?formattedParcelCodes=99\.00\.111111\.22222222/,
  );
  const ship = (await fakeLog(request)).find((e) => e.path === "functions/admin-actions");
  expect(ship?.body).toMatchObject({
    action: "ship",
    orderId: "o-1040",
    trackingNumber: "99.00.111111.22222222",
    notify: true,
  });

  await page.getByLabel("Notiz").fill("Kunde möchte Abholung in Zürich");
  await page.getByText("Zum Prüfen markieren").click();
  await page
    .locator(".admin-panel", { hasText: "Interne Notiz" })
    .getByRole("button", { name: "Speichern" })
    .click();
  await toast(page, "Gespeichert.");
  const note = (await fakeLog(request)).find((e) => e.path === "orders:update");
  expect(note?.body).toEqual({
    admin_note: "Kunde möchte Abholung in Zürich",
    needs_attention: true,
  });

  const restock = page.locator(".admin-panel", { hasText: "Retoure einbuchen" });
  await restock.getByRole("combobox").selectOption("1");
  await restock.getByRole("button", { name: "An Lager nehmen" }).click();
  await toast(page, "1 Stück wieder an Lager.");
  await shot(page, info, "bestellung");

  await open(page, "/admin/bestellungen?ansicht=shipped");
  await expect(page.getByRole("link", { name: "AX-1040" })).toBeVisible();
  await open(page, "/admin/bestellungen?ansicht=all&suche=ax-1042");
  await expect(page.locator(".admin-table tbody tr")).toHaveCount(1);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("Admin: Produkt anlegen mit Grösse, Anfangsbestand und Bild; danach im Shop", async ({
  page,
  request,
}, info) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await adminSignIn(page, "/admin/anmelden?weiter=/admin/produkte");
  await page.getByRole("link", { name: "Neues Produkt" }).click();
  await page.getByLabel("Titel", { exact: true }).fill("Sakko Rigi");
  await page.getByLabel("Farbname", { exact: true }).fill("Grau");
  await expect(page.getByLabel("Adresse im Shop")).toHaveValue("sakko-rigi-grau");
  await expect(page.getByLabel("Modell")).toHaveValue("sakko-rigi");
  await page.getByLabel("Preis (CHF, inkl. MWST)").fill("39");
  await page.getByLabel("Streichpreis (CHF, freiwillig)").fill("29");
  await page.getByLabel("Status").selectOption("active");
  await page.getByRole("button", { name: "Produkt anlegen" }).click();
  await expect(page.getByText("Der Streichpreis muss höher sein als der Preis.")).toBeVisible();
  await page.getByLabel("Preis (CHF, inkl. MWST)").fill("399");
  await page.getByLabel("Streichpreis (CHF, freiwillig)").fill("");
  await page.getByRole("button", { name: "Produkt anlegen" }).click();
  await toast(page, "Produkt angelegt.");
  await toast(page, "automatisch ins Englische übersetzt");
  await expect(page).toHaveURL(/\/admin\/produkte\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Sakko Rigi · Grau" })).toBeVisible();
  // Englisch entsteht beim Speichern automatisch aus dem Deutschen
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("EN Sakko Rigi");
  await expect(page.getByLabel("Colour name", { exact: true })).toHaveValue("EN Grau");

  // Deutsch geändert: maschinelles Englisch folgt dem Deutschen
  const save = page.getByRole("button", { name: "Änderungen speichern" });
  await page.getByLabel("Titel", { exact: true }).fill("Sakko Rigi Wolle");
  await save.click();
  await toast(page, "automatisch ins Englische übersetzt");
  await expect(page.getByRole("heading", { name: "Sakko Rigi Wolle · Grau" })).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("EN Sakko Rigi Wolle");
  // Englisch von Hand: bleibt stehen, auch wenn sich das Deutsch später ändert
  await page.getByLabel("Title", { exact: true }).fill("Rigi wool jacket");
  await save.click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Rigi wool jacket");
  await page.waitForTimeout(500);
  await page.getByLabel("Titel", { exact: true }).fill("Sakko Rigi Flanell");
  await save.click();
  await toast(page, "Ein deutscher Text hat sich geändert (Titel)");
  await expect(page.getByRole("heading", { name: "Sakko Rigi Flanell · Grau" })).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Rigi wool jacket");
  const updates = (await fakeLog(request)).filter((e) => e.path === "products:update");
  expect(updates.at(-1)?.body).toMatchObject({
    title_de: "Sakko Rigi Flanell",
    title_en: "Rigi wool jacket",
    en_auto: ["color_name"],
  });

  // Herkunft und Ausstattung (ein Merkmal pro Zeile) für die Produktseite
  await page.getByLabel("Herkunft", { exact: true }).fill("Gefertigt in Italien");
  await page
    .getByLabel("Ausstattung (ein Merkmal pro Zeile)")
    .fill("- Zweiknopf-Sakko\n\nFlanell aus Biella");
  await save.click();
  await expect(async () => {
    const last = (await fakeLog(request)).filter((e) => e.path === "products:update").at(-1);
    expect(last?.body).toMatchObject({
      origin_de: "Gefertigt in Italien",
      features_de: "- Zweiknopf-Sakko\n\nFlanell aus Biella",
    });
  }).toPass({ timeout: 10_000 });

  const sizes = page.locator(".admin-panel", { hasText: "Grössen und Bestand" });
  await sizes.getByLabel("Neue Grösse").fill("50");
  await sizes.getByLabel("Anfangsbestand").fill("4");
  await sizes.getByRole("button", { name: "Grösse hinzufügen" }).click();
  await toast(page, "Grösse 50 angelegt.");
  await expect(sizes.locator("tbody tr").first()).toContainText("4");
  const adjust = (await fakeLog(request)).find((e) => e.path === "rpc/admin_adjust_stock");
  expect(adjust?.body).toMatchObject({
    p_delta: 4,
    p_reason: "correction",
    p_note: "Anfangsbestand",
  });
  const inserted = (await fakeLog(request)).find((e) => e.path === "product_variants:insert");
  expect(inserted?.body).not.toHaveProperty("stock");

  await page.locator('.admin-panel:has-text("Bilder") input[type=file]').setInputFiles({
    name: "sakko.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await toast(page, "Bild hochgeladen.");
  await expect(page.locator(".admin-images li")).toHaveCount(1);
  await expect(page.locator(".admin-images img")).toHaveJSProperty("naturalWidth", 1);
  const upload = (await fakeLog(request)).find((e) => e.path === "storage:upload");
  expect(String(upload?.body["path"])).toMatch(
    /^product-images\/sakko-rigi-grau\/[0-9a-f-]{36}\.(webp|jpg)$/,
  );
  await shot(page, info, "produkt");

  // Der Shop speichert den Katalog bis zu 30 Sekunden zwischen (auch beim Server-Rendering).
  await expect(async () => {
    await open(page, "/produkt/sakko-rigi-grau");
    await expect(page.getByRole("heading", { name: "Sakko Rigi", level: 1 })).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 45_000, intervals: [2_000, 5_000, 10_000] });
  await expect(page.locator(".product-buy .price").first()).toContainText("399.00");
  await expect(page.locator(".product-facts")).toContainText("Gefertigt in Italien");
  await expect(page.locator(".product-features li")).toHaveText([
    "Zweiknopf-Sakko",
    "Flanell aus Biella",
  ]);
  await expect(page.locator(".sample-notice")).toHaveCount(0);

  // Gleiche Adresse ein zweites Mal geht nicht
  await open(page, "/admin/produkte/neu");
  await page.getByLabel("Titel", { exact: true }).fill("Sakko Rigi");
  await page.getByLabel("Farbname", { exact: true }).fill("Grau");
  await page.getByLabel("Preis (CHF, inkl. MWST)").fill("399");
  await page.getByRole("button", { name: "Produkt anlegen" }).click();
  await toast(page, "Diesen Wert gibt es schon");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("Admin: Musterstück weiterführen – Kennzeichen «Muster» entfernen", async ({
  page,
  request,
}) => {
  await adminSignIn(page, "/admin/anmelden?weiter=/admin/produkte");
  const row = page.locator(".admin-table tbody tr", { hasText: "/weste-limmat-marine" });
  await expect(row.locator(".admin-badge", { hasText: "Muster" })).toBeVisible();
  await row.getByRole("link", { name: "Weste «Limmat»" }).click();
  const sample = page.getByLabel("Muster (Vorführware)");
  await expect(sample).toBeChecked();
  await sample.uncheck();
  await page.getByRole("button", { name: "Änderungen speichern" }).click();
  await expect(async () => {
    const last = (await fakeLog(request)).filter((e) => e.path === "products:update").at(-1);
    expect(last?.body["tags"]).toEqual(["neu"]);
  }).toPass({ timeout: 10_000 });
});

test("Admin: Lager – Verkauf im Laden und Korrektur nur mit Grund", async ({
  page,
  request,
}, info) => {
  await adminSignIn(page, "/admin/anmelden?weiter=/admin/lager");
  await expect(page.getByRole("heading", { name: "Lager" })).toBeVisible();
  await page.getByLabel("Lager durchsuchen").fill("Salbeigrün");
  const row = page.locator(".admin-stock-table tbody tr").filter({ hasText: "48" }).first();
  await expect(row).toContainText("3");
  await row.getByRole("button", { name: "Verkauf im Laden −1" }).click();
  await toast(page, /Verkauf gebucht: .*Noch 2 an Lager\./);
  await expect(row).toContainText("2");
  await shot(page, info, "lager");

  await row.getByRole("button", { name: "Ändern" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Was ist passiert?").selectOption("correction");
  await dialog.getByLabel("Neuer Bestand (gezählt)").fill("7");
  await expect(dialog.getByText("Danach an Lager: 7")).toBeVisible();
  await dialog.getByRole("button", { name: "Speichern" }).click();
  await expect(dialog.getByText("Bitte einen Grund für die Korrektur angeben.")).toBeVisible();
  await dialog.getByLabel("Grund (Pflicht)").fill("Inventur Oktober");
  await dialog.getByRole("button", { name: "Speichern" }).click();
  await toast(page, /: 7$/);
  const moves = (await fakeLog(request)).filter((e) => e.path === "rpc/admin_adjust_stock");
  expect(moves.map((m) => [m.body["p_delta"], m.body["p_reason"]])).toEqual([
    [-1, "sale_store"],
    [5, "correction"],
  ]);
  await expect(page.locator(".admin-panel", { hasText: "Letzte Bewegungen" })).toContainText(
    "Inventur Oktober",
  );
});

test("Admin: Rabattcode anlegen und im Warenkorb einlösen", async ({ page }) => {
  await adminSignIn(page, "/admin/anmelden?weiter=/admin/rabattcodes");
  await page.getByRole("button", { name: "Neuer Code" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Code", { exact: true }).fill("herbst 20");
  await expect(dialog.getByLabel("Code", { exact: true })).toHaveValue("HERBST20");
  await dialog.getByLabel("Art", { exact: true }).selectOption("amount");
  await dialog.getByLabel("Rabatt in CHF").fill("20");
  await dialog.getByLabel("Mindestbestellwert in CHF (freiwillig)").fill("100");
  await dialog.getByRole("button", { name: "Speichern" }).click();
  await toast(page, "Code HERBST20 gespeichert.");
  await expect(page.locator(".admin-table")).toContainText("HERBST20");
  await expect(page.locator(".admin-table")).toContainText("ab CHF 100.00");

  await open(page, "/produkt/weste-limmat-marine");
  await page.locator(".size-grid button:not([disabled])").first().click();
  await page.locator(".add-row").getByRole("button", { name: "In den Warenkorb" }).click();
  await open(page, "/warenkorb");
  await page.getByRole("button", { name: "Rabattcode oder Gutschein einlösen" }).click();
  const field = page.locator(".code-field").filter({ hasText: "Rabattcode" });
  await field.getByLabel("Rabattcode").fill("herbst20");
  await field.getByRole("button", { name: "Einlösen" }).click();
  await expect(page.locator(".code-applied").filter({ hasText: "HERBST20" })).toContainText(
    "−CHF 20.00",
  );
  await expect(page.locator(".checkout-totals")).toContainText("−CHF 20.00");
});

test("Admin: Gutschein ausstellen und sperren", async ({ page, request }) => {
  await adminSignIn(page, "/admin/anmelden?weiter=/admin/gutscheine");
  await page.getByRole("button", { name: "Gutschein ausstellen" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Betrag in CHF").fill("75");
  await dialog.getByLabel("Name der beschenkten Person").fill("Nora");
  await dialog.getByLabel("E-Mail der beschenkten Person").fill("nora@example.ch");
  await dialog.getByLabel("Interne Notiz").fill("Kulanz AX-1042");
  await dialog.getByRole("button", { name: "Ausstellen" }).click();
  const code = dialog.locator(".admin-code-big");
  await expect(code).toHaveText(/^AXN-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  const issued = await code.textContent();
  await expect(dialog.getByText("Die E-Mail ist unterwegs.")).toBeVisible();
  await dialog.getByRole("button", { name: "Fertig" }).click();
  const issue = (await fakeLog(request)).find((e) => e.path === "functions/admin-actions");
  expect(issue?.body).toMatchObject({
    action: "issue_gift_card",
    amountCents: 7500,
    recipientName: "Nora",
    send: true,
  });

  const row = page.locator(".admin-table tbody tr", { hasText: issued! });
  await expect(row).toContainText("Nora");
  await row.getByRole("button", { name: "Details" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sperren" }).click();
  await toast(page, "Gutschein gesperrt.");
  await expect(row).toContainText("Gesperrt");
});

test("Admin: Startseite (mit Video) und Laufband ändern, im Shop sichtbar", async ({
  page,
  request,
}, info) => {
  test.setTimeout(120_000);
  await adminSignIn(page, "/admin/anmelden?weiter=/admin/inhalte");
  const hero = page.locator(".admin-panel", { hasText: "Einstieg (oben" });
  await hero.getByLabel("Titel").first().fill("Herbst bei Axion.");
  // Videos über dem Bild, quer und fürs Handy (der Nachbau speichert die Dateien nur, abgespielt wird nichts)
  const videoInputs = hero.locator('input[type=file][accept^="video"]');
  await videoInputs.nth(0).setInputFiles({
    name: "einstieg.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("kein echtes Video"),
  });
  await expect(hero.locator(".admin-image-field video")).toHaveCount(1);
  await videoInputs.nth(1).setInputFiles({
    name: "einstieg-handy.webm",
    mimeType: "video/webm",
    buffer: Buffer.from("kein echtes Video"),
  });
  await expect(hero.locator(".admin-image-field video")).toHaveCount(2);
  const uploads = (await fakeLog(request))
    .filter((e) => e.path === "storage:upload")
    .map((e) => String(e.body["path"]));
  expect(uploads).toHaveLength(2);
  expect(uploads[0]).toMatch(/^site-media\/hero\/[0-9a-f-]{36}\.mp4$/);
  expect(uploads[1]).toMatch(/^site-media\/hero\/[0-9a-f-]{36}\.webm$/);
  await hero.getByRole("button", { name: "Speichern" }).click();
  // Englisch aus dem Seed gilt als von Hand geschrieben: bleibt stehen, Hinweis zum Prüfen
  await toast(page, "Ein deutscher Text hat sich geändert (Titel)");

  const ticker = page.locator(".admin-panel", { hasText: "Laufband" }).first();
  await ticker.getByLabel("Satz 1").fill("Neue Herbstkollektion ist da");
  await ticker.getByRole("button", { name: "Laufband speichern" }).click();
  await toast(page, "Ein deutscher Text hat sich geändert (Satz 1)");

  // Am Computer das quere Video, auf dem Handy das eigene (Bild bleibt als Vorschau darunter)
  const expected = info.project.name === "handy" ? uploads[1] : uploads[0];
  const video = page.locator(".hero-media video");
  // Der Server hält Inhalte bis zu 30 Sekunden im Zwischenspeicher (auch aus dem Lauf davor):
  // neu laden, bis Titel, Laufband und die Videos dieses Laufs da sind
  await expect(async () => {
    await open(page, "/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Herbst bei Axion.", {
      timeout: 1000,
    });
    await expect(page.locator(".announcement")).toContainText("Neue Herbstkollektion ist da", {
      timeout: 1000,
    });
    await expect(video).toHaveAttribute(
      "src",
      new RegExp(`/storage/v1/object/public/${expected!.replace(/[.]/g, "\\.")}$`),
      { timeout: 1000 },
    );
  }).toPass({ timeout: 60_000, intervals: [2_000, 5_000, 10_000] });
  await expect(page.locator(".hero-media img")).toHaveCount(1);
  // Anhalten und wieder abspielen (WCAG 2.2.2)
  await page.getByRole("button", { name: "Video anhalten" }).click();
  await expect(page.getByRole("button", { name: "Video abspielen" })).toBeVisible();
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  await page.getByRole("button", { name: "Video abspielen" }).click();
  await expect(page.getByRole("button", { name: "Video anhalten" })).toBeVisible();
  await shot(page, info, "startseite-video");
});

test("Admin: Zugänge geben und entfernen, Versandkosten im Warenkorb", async ({ page }) => {
  await adminSignIn(page, "/admin/anmelden?weiter=/admin/zugaenge");
  const form = page.locator(".admin-panel", { hasText: "Zugang geben" });
  await form.getByLabel("E-Mail-Adresse").fill("unbekannt@example.ch");
  await form.getByRole("button", { name: "Zugang geben" }).click();
  await toast(page, "Zu dieser E-Mail-Adresse gibt es kein Konto.");
  await form.getByLabel("E-Mail-Adresse").fill(FIXTURES.email);
  await form.getByRole("button", { name: "Zugang geben" }).click();
  await toast(page, `${FIXTURES.email} hat jetzt Zugang zum Admin.`);
  const row = page.locator(".admin-table tbody tr", { hasText: FIXTURES.email });
  await row.getByRole("button", { name: "Zugang entfernen" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Entfernen" }).click();
  await toast(page, "Zugang entfernt.");
  await expect(row).toHaveCount(0);

  await open(page, "/admin/einstellungen");
  await page.getByLabel("Versandkosten (CHF)").fill("9");
  await page.getByLabel("Gratisversand ab Warenwert (CHF, freiwillig)").fill("300");
  await page.getByRole("button", { name: "Einstellungen speichern" }).click();
  await toast(page, "Einstellungen gespeichert.");

  await open(page, "/produkt/weste-limmat-marine");
  await page.locator(".size-grid button:not([disabled])").first().click();
  await page.locator(".add-row").getByRole("button", { name: "In den Warenkorb" }).click();
  await open(page, "/warenkorb");
  await expect(page.locator(".checkout-totals")).toContainText("CHF 9.00");
});

test("Admin: Exporte für Excel (Newsletter, Bestellungen)", async ({ page }) => {
  await adminSignIn(page, "/admin/anmelden?weiter=/admin/newsletter");
  const [newsletter] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Bestätigte exportieren (CSV)" }).click(),
  ]);
  const text = await readFile((await newsletter.path())!, "utf8");
  expect(text.startsWith("﻿E-Mail;Sprache;Bestätigt am")).toBe(true);
  expect(text).toContain("leserin@example.ch");
  expect(text).not.toContain("reader@example.com");

  await open(page, "/admin/bestellungen");
  await page.getByRole("button", { name: "Export (CSV)" }).click();
  await page.getByRole("dialog").getByLabel("Von").fill("2026-09-01");
  const [orders] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("dialog").getByRole("button", { name: "CSV herunterladen" }).click(),
  ]);
  const csv = await readFile((await orders.path())!, "utf8");
  expect(orders.suggestedFilename()).toMatch(
    /^axion-bestellungen-2026-09-01-bis-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  expect(csv).toContain("AX-1042;Warenkorb");
  expect(csv).toContain("Anzug Limmat");
  expect(csv).not.toContain("AX-1044"); // abgebrochen
});
