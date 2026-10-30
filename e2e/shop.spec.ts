// Abläufe im Browser: Sprache, Warenkorb und Kasse, Bestellstatus, Kundenkonto, Gutschein, Newsletter.
// Läuft gegen e2e/fake-supabase.ts (wird vor jedem Test zurückgesetzt). Bildschirmfotos: .local/e2e-shots/
import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import { FIXTURES } from "./fake-supabase";

const FAKE = "http://127.0.0.1:54400";

interface LogEntry {
  path: string;
  body: Record<string, unknown>;
  auth: string | null;
}

async function fakeLog(request: APIRequestContext): Promise<LogEntry[]> {
  return (await (await request.get(`${FAKE}/__log`)).json()) as LogEntry[];
}

/** Fehler im Browser sammeln (Abstürze und Konsolenfehler, ohne fehlende Bilder/Favicons). */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource"))
      errors.push(m.text());
  });
  return errors;
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "Seite ist breiter als der Bildschirm").toBeLessThanOrEqual(1);
}

async function shot(page: Page, info: TestInfo, name: string) {
  await page.screenshot({
    path: `.local/e2e-shots/${info.project.name}-${name}.png`,
    fullPage: true,
  });
}

/** Seite öffnen und warten, bis React sie übernommen hat (sonst gehen frühe Eingaben verloren). */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator("html[data-hydrated]").waitFor({ state: "attached", timeout: 30_000 });
}

async function signIn(page: Page, path = "/konto/anmelden") {
  await open(page, path);
  const form = page.locator(".account-form");
  await form.getByLabel("E-Mail-Adresse").fill(FIXTURES.email);
  await form.getByLabel("Passwort", { exact: true }).fill(FIXTURES.password);
  await form.getByRole("button", { name: "Anmelden" }).click();
}

test.beforeEach(async ({ request }) => {
  await request.post(`${FAKE}/__reset`);
});

test("Startseite auf Deutsch und Englisch mit hreflang und Sprachwechsel", async ({
  page,
}, info) => {
  const errors = watchErrors(page);
  await open(page, "/");
  await expect(page.locator("html")).toHaveAttribute("lang", "de-CH");
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    "href",
    /\/en$/,
  );
  await expectNoHorizontalScroll(page);
  await page.locator(".footer-language").click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".footer-language")).toHaveText("DE");
  await shot(page, info, "home-en");

  await open(page, "/en/produkt/anzug-limmat-marine");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  // Ohne gewählte Grösse heisst der Kaufknopf «Choose size» (und ist aktiv)
  await expect(page.locator(".add-row").getByRole("button", { name: "Choose size" })).toBeEnabled();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/en\/produkt\/anzug-limmat-marine$/,
  );

  // Nur DE (ohne Präfix) und EN: andere Sprachkürzel sind «nicht gefunden»
  const fr = await page.goto("/fr/produkt/anzug-limmat-marine");
  expect(fr?.status()).toBe(404);
  await expect(page.getByText("Dieses Stück fehlt.")).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

/** Positionen im Warenkorb (wie im Browser gespeichert). */
async function cartLines(page: Page): Promise<{ variantId: string; quantity: number }[]> {
  return page.evaluate(
    () =>
      (JSON.parse(localStorage.getItem("axion-cart") ?? "{}") as { state?: { lines?: [] } }).state
        ?.lines ?? [],
  );
}

/** Erste lieferbare Grösse in einer Auswahlliste wählen; gibt die Variante zurück. */
async function chooseFirstSize(select: ReturnType<Page["locator"]>): Promise<string> {
  const value = await select
    .locator("option:not([disabled]):not([value=''])")
    .first()
    .getAttribute("value");
  expect(value).toBeTruthy();
  await select.selectOption(value!);
  return value!;
}

test("Startseite: Look direkt kaufen – Grössen wählen, ganzer Look oder nur die Auswahl", async ({
  page,
}, info) => {
  const errors = watchErrors(page);
  await open(page, "/");
  const look = page.locator(".look-section");
  const addAll = look.getByRole("button", { name: "Ganzen Look in den Warenkorb" });
  await expect(look.locator(".look-item")).toHaveCount(3);
  await expect(look.locator(".look-total")).toContainText("Ganzes Outfit");

  // Ohne Grössen: Hinweis, erste fehlende Grösse im Fokus, Warenkorb bleibt zu und leer
  await addAll.click();
  await expect(look.getByRole("alert")).toHaveText(
    "Bitte wähle eine Grösse für jedes ausgewählte Stück.",
  );
  await expect(look.getByLabel("Grösse für Anzug «Limmat», Marine")).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await cartLines(page)).toEqual([]);

  const chosen: string[] = [];
  for (const select of await look.locator(".look-size").all())
    chosen.push(await chooseFirstSize(select));
  await expect(look.getByRole("alert")).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await look.screenshot({ path: `.local/e2e-shots/${info.project.name}-look.png` });
  await addAll.click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "Dein Warenkorb" })).toBeVisible();
  await expect(drawer.locator(".cart-line")).toHaveCount(3);
  expect(await cartLines(page)).toEqual(chosen.map((variantId) => ({ variantId, quantity: 1 })));
  // Escape erst, wenn die Schublade ganz offen ist und der Fokus darin liegt (unter Last setzt Radix ihn erst nach der Einblendung)
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute("data-state", "open");
  await expect(drawer.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  // Ausblend-Animation und Fokus-Rückgabe können unter Last lange dauern: grosszügig warten, aber echten Fehler nicht verstecken
  await expect(drawer).toHaveCount(0, { timeout: 20000 });

  // Englisch: Weste abwählen, nur Anzug und Schuhe dazulegen
  await open(page, "/en");
  const lookEn = page.locator(".look-section");
  await lookEn.getByRole("checkbox", { name: "Select Limmat Waistcoat, Navy" }).uncheck();
  await expect(lookEn.locator(".look-total")).toContainText("Selected: 2 of 3 pieces");
  await chooseFirstSize(lookEn.getByLabel("Size for Limmat Suit, Navy"));
  await chooseFirstSize(lookEn.getByLabel("Size for Nero Oxford, Black"));
  await lookEn.getByRole("button", { name: "Add selection to cart" }).click();
  await expect(page.getByRole("dialog").locator(".cart-line")).toHaveCount(3);
  expect(await cartLines(page)).toEqual([
    { variantId: chosen[0], quantity: 2 },
    { variantId: chosen[1], quantity: 1 },
    { variantId: chosen[2], quantity: 2 },
  ]);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("Startseite und Menü: Neuheiten gleich nach dem Einstieg, alle Kategorien, Einheitsgrösse", async ({
  page,
}, info) => {
  const errors = watchErrors(page);
  await open(page, "/");
  // Wie im Reel: direkt nach dem Einstieg die neuesten Stücke als Raster, dann die Kategorien zum Blättern
  expect(await page.evaluate(() => document.querySelector(".hero")?.nextElementSibling?.id)).toBe(
    "neuheiten",
  );
  const fresh = page.locator("#neuheiten .product-card");
  await expect(fresh).toHaveCount(8);
  await expect(fresh.first().getByRole("heading")).toHaveText("Mantel «Gotthard»");
  await expect(page.locator("#kollektionen .category-card")).toHaveCount(9);
  await expectNoHorizontalScroll(page);

  // Alle Kategorien im Menü: am Computer unter «Kollektion», auf dem Handy im Menü
  if (info.project.name === "desktop") {
    await page.getByRole("button", { name: "Kollektion", exact: true }).click();
    const menu = page.locator("#collection-navigation");
    await expect(menu.getByRole("link")).toHaveText([
      "Anzüge",
      "Sakkos",
      "Hosen",
      "Hemden",
      "Westen",
      "Mäntel & Jacken",
      "Strick",
      "Schuhe",
      "Accessoires",
      "Alle Stücke",
    ]);
    await menu.getByRole("link", { name: "Accessoires" }).click();
  } else {
    await page.getByRole("button", { name: "Menü öffnen" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Accessoires" }).click();
  }
  await expect(page).toHaveURL(/\/kollektion\/accessoires$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accessoires");
  await expect(page.locator(".product-card")).toHaveCount(8);

  // Einheitsgrösse: nichts zu wählen, direkt in den Warenkorb; im Warenkorb «Einheitsgrösse», nicht «Grösse One Size»
  await open(page, "/produkt/krawatte-morcote-bordeaux");
  await expect(page.locator(".size-single")).toHaveText("Einheitsgrösse");
  await expect(page.locator(".size-grid")).toHaveCount(0);
  await expect(page.locator(".size-hint")).toHaveCount(0);
  await page.locator(".add-row").getByRole("button", { name: "In den Warenkorb" }).click();
  const line = page.getByRole("dialog").locator(".cart-line");
  await expect(line).toHaveCount(1);
  await expect(line).toContainText("Bordeaux · Einheitsgrösse");
  await page.keyboard.press("Escape");

  // Gürtel: echte Grössen, ohne Wahl kein Warenkorb
  await open(page, "/produkt/guertel-chur-braun");
  await expect(page.locator(".size-grid button")).toHaveCount(5);
  // Ohne Wahl: Knopf «Grösse wählen» (aktiv), Hinweis erst nach dem Klick, nichts im Warenkorb
  await expect(page.locator(".size-hint")).toHaveCount(0);
  await expect(
    page.locator(".add-row").getByRole("button", { name: "In den Warenkorb" }),
  ).toHaveCount(0);
  await page.locator(".add-row").getByRole("button", { name: "Grösse wählen" }).click();
  await expect(page.locator(".size-hint")).toBeVisible();
  await expect(page.locator(".size-grid button:not([disabled])").first()).toBeFocused();
  // Im Warenkorb bleibt nur die Krawatte von oben
  expect(await cartLines(page)).toHaveLength(1);
  await shot(page, info, "accessoires-guertel");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("Produktseite: Komplettes Outfit legt die gewählten Stücke zusammen in den Warenkorb", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await open(page, "/produkt/anzug-limmat-marine");
  const builder = page.locator("#outfit");
  // Dieses Stück ist die erste Zeile, dazu die passenden: Weste und Schuhe
  await expect(builder.locator(".outfit-row")).toHaveCount(3);
  const add = builder.getByRole("button", { name: "3 Stücke in den Warenkorb" });
  await add.click();
  await expect(builder.getByRole("alert")).toHaveText(
    "Bitte wähle eine Grösse für jedes ausgewählte Stück.",
  );
  await expect(builder.getByLabel("Grösse für Anzug «Limmat», Marine")).toBeFocused();
  expect(await cartLines(page)).toEqual([]);

  // Anzug und Schuhe abwählen, nur die Weste mit Grösse
  await builder.getByRole("checkbox", { name: "Anzug «Limmat», Marine auswählen" }).uncheck();
  await builder.getByRole("checkbox", { name: "Oxford «Nero», Schwarz auswählen" }).uncheck();
  const vest = await chooseFirstSize(builder.getByLabel("Grösse für Weste «Limmat», Marine"));
  await builder.getByRole("button", { name: "1 Stück in den Warenkorb" }).click();
  await expect(page.getByRole("dialog").locator(".cart-line")).toHaveCount(1);
  expect(await cartLines(page)).toEqual([{ variantId: vest, quantity: 1 }]);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("Produktseite: Muster-Hinweis, Details, knapper Bestand, Klarna und Service", async ({
  page,
}, info) => {
  const errors = watchErrors(page);
  await open(page, "/kollektion/anzuege");
  const cards = page.locator(".product-card");
  await expect(cards).toHaveCount(10);
  await expect(page.locator(".product-badge.is-sample")).toHaveCount(10);
  await expect(page.locator(".product-badge").first()).toHaveText("Muster");

  // Bestand der Grössen 46–56: 2, 3, 3, 2, 1, 0
  await open(page, "/produkt/anzug-limmat-anthrazit");
  await expect(page.locator(".sample-notice")).toBeVisible();
  await expect(page.locator(".product-gallery img")).toHaveCount(2);
  await expect(page.locator(".product-facts")).toContainText("Gefertigt in Italien");
  await expect(page.locator(".product-features li").first()).toBeVisible();
  // Hinweis auf knappen Bestand erst mit gewählter Grösse, ab 2 Stück; die Meldezone bleibt im Dokument
  const hint = page.getByRole("status").and(page.locator(".stock-hint"));
  await expect(hint).toBeEmpty();
  await page.locator(".size-grid").getByRole("button", { name: "46", exact: true }).click();
  await expect(hint).toHaveText("Nur noch 2 an Lager");
  await page.locator(".size-grid").getByRole("button", { name: "48", exact: true }).click();
  await expect(hint).toBeEmpty();
  await expect(page.locator(".pay-hint")).toContainText("Klarna");
  await expect(page.locator(".consult-card")).toContainText("Persönlicher Service");
  await expectNoHorizontalScroll(page);
  await shot(page, info, "produktseite");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("Warenkorb bis Bestellung: Rabattcode, Gutschein, E-Mail, danach leerer Warenkorb", async ({
  page,
  request,
}, info) => {
  const errors = watchErrors(page);
  await open(page, "/produkt/weste-limmat-marine");
  await page.locator(".size-grid button:not([disabled])").first().click();
  await page.locator(".add-row").getByRole("button", { name: "In den Warenkorb" }).click();
  await page.getByRole("button", { name: "Zur Kasse" }).click();
  await expect(page).toHaveURL(/\/warenkorb$/);
  await expect(page.getByRole("heading", { name: "Dein Warenkorb" })).toBeVisible();

  await page.getByRole("button", { name: "Rabattcode oder Gutschein einlösen" }).click();
  const discount = page.locator(".code-field").filter({ hasText: "Rabattcode" });
  await discount.getByLabel("Rabattcode").fill("falsch");
  await discount.getByRole("button", { name: "Einlösen" }).click();
  await expect(page.getByText("Diesen Rabattcode gibt es nicht.")).toBeVisible();
  await discount.getByLabel("Rabattcode").fill(FIXTURES.discountCode.toLowerCase());
  await discount.getByRole("button", { name: "Einlösen" }).click();
  await expect(
    page.locator(".code-applied").filter({ hasText: FIXTURES.discountCode }),
  ).toBeVisible();

  const gift = page.locator(".code-field").filter({ hasText: "Gutscheincode" });
  await gift.getByLabel("Gutscheincode").fill("axn test 0000 0001");
  await gift.getByRole("button", { name: "Einlösen" }).click();
  await expect(page.getByText("Guthaben: CHF 50.00")).toBeVisible();
  await expect(page.locator(".checkout-totals")).toContainText("Rabatt (AXION10)");

  await page.getByLabel("E-Mail für die Bestellbestätigung").fill("gast@example");
  await page.getByRole("button", { name: "Weiter zur Zahlung" }).click();
  await expect(page.getByText("Bitte gib eine gültige E-Mail-Adresse ein.")).toBeVisible();
  await page.getByLabel("E-Mail für die Bestellbestätigung").fill("gast@example.ch");
  // Einwilligung zur Erinnerung: standardmässig aus, nur mit Häkchen wird sie mitgeschickt
  const remind = page.getByLabel("Erinnere mich per E-Mail, falls ich den Kauf nicht abschliesse");
  await expect(remind).not.toBeChecked();
  await remind.check();
  await expectNoHorizontalScroll(page);
  await shot(page, info, "warenkorb");
  await page.getByRole("button", { name: "Weiter zur Zahlung" }).click();

  await expect(page).toHaveURL(/\/bestellung\/[0-9a-f-]{36}$/); // «bezahlt» wird aus der Adresse entfernt
  await expect(page.getByRole("heading", { name: "Danke für deine Bestellung" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/g\*\*\*@example\.ch/)).toBeVisible();
  await shot(page, info, "bestellung-danke");

  const checkout = (await fakeLog(request)).find((e) => e.path === "functions/checkout");
  expect(checkout?.body).toMatchObject({
    kind: "cart",
    email: "gast@example.ch",
    discountCode: "axion10",
    giftCardCode: FIXTURES.giftCard,
    remind: true,
    locale: "de",
  });

  await open(page, "/warenkorb");
  await expect(page.getByText("Noch nichts ausgewählt")).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("Ausverkauft beim Bezahlen: Warenkorb wird angepasst und erklärt", async ({ page }) => {
  await open(page, "/produkt/weste-limmat-marine");
  await page.locator(".size-grid button:not([disabled])").first().click();
  await page.locator(".add-row").getByRole("button", { name: "In den Warenkorb" }).click();
  await open(page, "/warenkorb");
  await page.getByLabel("E-Mail für die Bestellbestätigung").fill(FIXTURES.outOfStockEmail);
  await page.getByRole("button", { name: "Weiter zur Zahlung" }).click();
  await expect(
    page.getByText("Nicht mehr alles ist verfügbar. Wir haben deinen Warenkorb angepasst."),
  ).toBeVisible();
  await expect(page.getByText("Noch nichts ausgewählt")).toBeVisible();
});

test("Abbruch in der Stripe-Kasse gibt die Reservierung frei", async ({ page, request }) => {
  const token = "66666666-6666-4666-8666-666666666666";
  await open(page, `/warenkorb?abgebrochen=${token}`);
  await expect(page.getByText("Die Zahlung wurde abgebrochen.")).toBeVisible();
  await expect(page).toHaveURL(/\/warenkorb$/);
  await expect
    .poll(async () =>
      (await fakeLog(request)).some(
        (e) => e.path === "functions/checkout" && e.body["token"] === token,
      ),
    )
    .toBe(true);
});

test("Erinnerungslink: legt die Stücke der abgelaufenen Kasse in den Warenkorb", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await open(page, `/warenkorb/wiederherstellen/${FIXTURES.statusTokens.cancelled}`);
  await expect(page).toHaveURL(/\/warenkorb$/, { timeout: 15_000 });
  await expect(page.locator(".cart-line")).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  // Ungültiger oder fremder Link: kurze Meldung, nichts im Warenkorb
  await open(page, "/en/warenkorb/wiederherstellen/77777777-7777-4777-8777-777777777777");
  await expect(page.getByText("This link has expired or is not valid.")).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("Bestellstatus über das Token: versendet, abgebrochen, offen, unbekannt", async ({ page }) => {
  await open(page, `/bestellung/${FIXTURES.statusTokens.shipped}`);
  await expect(page.getByRole("heading", { name: "Deine Bestellung ist unterwegs" })).toBeVisible();
  await expect(page.getByText("Bestellung AX-1042")).toBeVisible();
  await open(page, `/en/bestellung/${FIXTURES.statusTokens.cancelled}`);
  await expect(page.getByRole("heading", { name: "This order was not completed" })).toBeVisible();
  await open(page, `/bestellung/${FIXTURES.statusTokens.pendingForever}`);
  await expect(page.getByText("Wir warten auf die Bestätigung deiner Zahlung …")).toBeVisible();
  await open(page, "/bestellung/77777777-7777-4777-8777-777777777777");
  await expect(page.getByRole("heading", { name: "Bestellung nicht gefunden" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});

test("Konto: Anmeldung, Gastbestellung zugeordnet, Bestellung, Daten, Abmelden", async ({
  page,
  request,
}, info) => {
  const errors = watchErrors(page);
  await open(page, "/konto/daten");
  await expect(page).toHaveURL(/\/konto\/anmelden\?weiter=%2Fkonto%2Fdaten$/);

  const form = page.locator(".account-form");
  await form.getByLabel("E-Mail-Adresse").fill(FIXTURES.email);
  await form.getByLabel("Passwort", { exact: true }).fill("falsches-passwort");
  await form.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByText("E-Mail-Adresse oder Passwort stimmen nicht.")).toBeVisible();
  await form.getByLabel("Passwort", { exact: true }).fill(FIXTURES.password);
  await form.getByRole("button", { name: "Anmelden" }).click();

  // Rücksprung auf die ursprünglich verlangte Seite
  await expect(page).toHaveURL(/\/konto\/daten$/);
  await expect(page.getByRole("heading", { name: "Deine Daten" })).toBeVisible();
  await page.getByLabel("Strasse und Nr.").fill("Bahnhofstrasse 1");
  await page.getByLabel("PLZ").fill("80011");
  await expect(page.getByLabel("PLZ")).toHaveValue("8001"); // höchstens 4 Zeichen
  await page.getByLabel("Ort", { exact: true }).fill("Zürich");
  await page.getByLabel("Land", { exact: true }).selectOption("LI");
  await page
    .locator("section")
    .filter({ hasText: "Persönliche Angaben" })
    .getByRole("button", { name: "Speichern" })
    .click();
  await expect(page.getByText("Gespeichert", { exact: true })).toBeVisible();
  const update = (await fakeLog(request)).find((e) => e.path === "profiles:update");
  expect(update?.body).toMatchObject({
    first_name: "Lena",
    address: { line1: "Bahnhofstrasse 1", postal_code: "8001", city: "Zürich", country: "LI" },
  });
  await expectNoHorizontalScroll(page);
  await shot(page, info, "konto-daten");

  await page.getByRole("link", { name: "Zurück zur Übersicht" }).click();
  await expect(page.getByRole("heading", { name: "Hallo Lena" })).toBeVisible();
  await expect(page.getByText("1 frühere Bestellung wurde deinem Konto zugeordnet.")).toBeVisible();
  await expect(page.locator(".account-table tbody tr")).toHaveCount(3);
  await expect(page.locator(".account-table")).toContainText("AX-1040"); // Gastbestellung
  await expectNoHorizontalScroll(page);
  await shot(page, info, "konto-uebersicht");

  await page.locator("tr", { hasText: "AX-1042" }).getByRole("link", { name: "Ansehen" }).click();
  await expect(page.getByRole("heading", { name: "Bestellung AX-1042" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sendung verfolgen" })).toHaveAttribute(
    "href",
    "https://www.post.ch/swisspost-tracking?formattedParcelCodes=99.00.123456.12345678",
  );
  await expect(page.locator(".order-summary")).toContainText("Rabatt (AXION10)");
  await expect(page.locator(".order-summary")).toContainText("Karte");
  await expectNoHorizontalScroll(page);
  await shot(page, info, "konto-bestellung");

  await open(page, "/konto");
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/konto\/anmelden/);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("Konto: Registrieren prüft Eingaben und zeigt den Bestätigungshinweis", async ({
  page,
}, info) => {
  await open(page, "/en/konto/registrieren");
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  const form = page.locator(".account-form");
  await form.getByRole("button", { name: "Create account" }).click();
  await expect(form.getByText("Required")).toHaveCount(2);
  await form.getByLabel("First name").fill("Nina");
  await form.getByLabel("Last name").fill("Beispiel");
  await form.getByLabel("Email address").fill("nina@example.ch");
  await form.getByLabel("Password", { exact: true }).fill("kurz");
  await form.getByLabel("Repeat password").fill("kurz");
  await form.getByRole("button", { name: "Create account" }).click();
  await expect(form.getByText("The password needs at least 10 characters.")).toBeVisible();
  await form.getByLabel("Password", { exact: true }).fill("ein-langes-passwort");
  await form.getByLabel("Repeat password").fill("ein-langes-passwort");
  await expectNoHorizontalScroll(page);
  await shot(page, info, "konto-registrieren-en");
  await form.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Almost done. Please confirm your email address")).toBeVisible();
});

test("Konto: Bestätigungslink wirkt erst per Klick, danach neues Passwort", async ({
  page,
}, info) => {
  await open(page, "/konto/bestaetigen?token_hash=abgelaufen&type=signup");
  await expect(page.getByRole("button", { name: "Jetzt bestätigen" })).toBeVisible();
  await page.getByRole("button", { name: "Jetzt bestätigen" }).click();
  await expect(page.getByText("Dieser Link ist ungültig oder abgelaufen.")).toBeVisible();

  await open(page, "/konto/bestaetigen?type=signup");
  await expect(page.getByText("Dieser Link ist ungültig oder abgelaufen.")).toBeVisible();

  await open(page, `/konto/bestaetigen?token_hash=${FIXTURES.validOtp}&type=recovery`);
  await shot(page, info, "konto-bestaetigen");
  await page.getByRole("button", { name: "Weiter zum neuen Passwort" }).click();
  await expect(page).toHaveURL(/\/konto\/passwort-neu$/);
  await page.getByLabel("Passwort", { exact: true }).fill(FIXTURES.password);
  await page.getByLabel("Passwort wiederholen").fill(FIXTURES.password);
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(
    page.getByText("Das neue Passwort muss sich vom bisherigen unterscheiden."),
  ).toBeVisible();
  await page.getByLabel("Passwort", { exact: true }).fill("ganz-neues-passwort");
  await page.getByLabel("Passwort wiederholen").fill("ganz-neues-passwort");
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(page.getByText("Dein neues Passwort ist gespeichert.")).toBeVisible();

  // Fremde Ziele in «next» werden ignoriert
  await open(
    page,
    `/konto/bestaetigen?token_hash=${FIXTURES.validOtp}&type=signup&next=//evil.example`,
  );
  await page.getByRole("button", { name: "Jetzt bestätigen" }).click();
  await expect(page.getByText("Bestätigt. Du bist angemeldet.")).toBeVisible();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:5173\/konto$/);
});

test("Konto: Passwort vergessen verrät nicht, ob es das Konto gibt", async ({ page }) => {
  await open(page, "/konto/passwort-vergessen");
  await page.locator(".account-form").getByLabel("E-Mail-Adresse").fill("unbekannt@example.ch");
  await page.getByRole("button", { name: "Link senden" }).click();
  await expect(page.getByText("Falls ein Konto mit dieser Adresse existiert")).toBeVisible();
});

test("Konto löschen nur nach Eingabe des Bestätigungsworts", async ({ page }) => {
  await signIn(page, "/konto/anmelden?weiter=/konto/daten");
  await expect(page.getByRole("heading", { name: "Deine Daten" })).toBeVisible();
  const danger = page.locator(".account-danger");
  await expect(danger.getByRole("button", { name: "Konto endgültig löschen" })).toBeDisabled();
  await danger.getByLabel("Tippe LÖSCHEN zur Bestätigung").fill("löschen");
  await danger.getByRole("button", { name: "Konto endgültig löschen" }).click();
  await expect(page.getByText("Dein Konto wurde gelöscht.")).toBeVisible();
  await open(page, "/konto");
  await expect(page).toHaveURL(/\/konto\/anmelden/);
});

test("Geschenkgutschein: Betrag, Empfänger, Vorschau, Weiterleitung und Guthaben", async ({
  page,
  request,
}, info) => {
  const errors = watchErrors(page);
  await open(page, "/geschenkgutschein");
  await expect(page.getByRole("heading", { name: "Geschenkgutschein", level: 1 })).toBeVisible();
  await expect(page.getByText("5 Jahre gültig")).toBeVisible();
  await page.locator(".choice-chip", { hasText: "Anderer Betrag" }).click();
  await page.getByLabel("Betrag in CHF").fill("10");
  await page.getByLabel("Name der beschenkten Person").fill("Marco");
  await page.getByLabel("Persönliche Nachricht (freiwillig)").fill("Alles Gute zum Geburtstag!");
  await page.getByLabel("Dein Name").fill("Lena");
  await expect(page.locator(".gift-card")).toContainText("Für Marco");
  await expect(page.locator(".gift-card")).toContainText("CHF —");
  await page.getByLabel("Deine E-Mail für die Bestätigung").fill("lena@example.ch");
  await page.getByRole("button", { name: "Weiter zur Zahlung" }).click();
  await expect(page.getByText("Bitte wähle einen Betrag im erlaubten Bereich.")).toBeVisible();
  await page.getByLabel("Betrag in CHF").fill("150");
  await expect(page.locator(".gift-card-amount")).toHaveText("CHF 150.00");
  await expectNoHorizontalScroll(page);
  await shot(page, info, "gutschein");
  await page.getByRole("button", { name: "Weiter zur Zahlung" }).click();
  await expect(page).toHaveURL(/\/bestellung\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Danke für deine Bestellung" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Der Gutschein ist unterwegs.")).toBeVisible();
  const checkout = (await fakeLog(request)).find((e) => e.path === "functions/checkout");
  expect(checkout?.body).toMatchObject({
    kind: "gift_card",
    amountCents: 15000,
    recipientName: "Marco",
    senderName: "Lena",
    message: "Alles Gute zum Geburtstag!",
    email: "lena@example.ch",
  });
  expect(checkout?.body).not.toHaveProperty("recipientEmail");

  await open(page, "/geschenkgutschein");
  const balance = page.locator(".gift-balance");
  await balance.getByRole("textbox").fill("axn-test-0000-0001");
  await balance.getByRole("button", { name: "Prüfen" }).click();
  await expect(balance.getByText("Guthaben CHF 50.00, gültig bis")).toBeVisible();
  await balance.getByRole("textbox").fill(FIXTURES.emptyGiftCard);
  await balance.getByRole("button", { name: "Prüfen" }).click();
  await expect(balance.getByText("Dieser Gutschein hat kein Guthaben mehr.")).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("Newsletter: Anmeldung im Footer, Bestätigen und Abmelden erst per Klick", async ({
  page,
  request,
}, info) => {
  // Ohne weiches Scrollen und 3D-Szene: Software-WebGL im Testbrowser bremst sonst das Scrollen zum Footer so stark,
  // dass der Klick auf ein noch fahrendes Feld fällt
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/");
  const form = page.locator(".footer-newsletter .newsletter-form");
  await form.getByLabel("E-Mail-Adresse für den Newsletter").fill("leser@example.ch");
  await form.getByRole("button", { name: "Abonnieren" }).click();
  await expect(
    form.getByText("Bitte bestätige, dass du den Newsletter erhalten möchtest."),
  ).toBeVisible();
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Abonnieren" }).click();
  await expect(page.locator(".footer-newsletter").getByText("Fast geschafft.")).toBeVisible();
  const subscribe = (await fakeLog(request)).find((e) => e.path === "functions/newsletter");
  expect(subscribe?.body).toMatchObject({
    action: "subscribe",
    email: "leser@example.ch",
    source: "footer",
    website: "",
  });
  // Der Client schickt nur die Zustimmung; den versionierten Text legt der Server fest (_shared/consent.ts)
  expect(subscribe?.body["consent"]).toBe(true);

  await open(page, `/newsletter/bestaetigen?token=${FIXTURES.newsletterConfirm}`);
  expect((await fakeLog(request)).filter((e) => e.path === "functions/newsletter")).toHaveLength(1);
  await shot(page, info, "newsletter-bestaetigen");
  await page.getByRole("button", { name: "Anmeldung bestätigen" }).click();
  await expect(page.getByText("Danke! Deine Anmeldung ist bestätigt.")).toBeVisible();

  await open(page, `/en/newsletter/abmelden?token=${FIXTURES.newsletterUnsubscribe}`);
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page.getByText("You have been unsubscribed")).toBeVisible();

  await open(page, "/newsletter/bestaetigen?token=kaputt");
  await expect(page.getByText("Dieser Link ist ungültig oder abgelaufen.")).toBeVisible();
});

test("Sitemap, englische Hilfe-Seiten und englische Rechtstexte mit Hinweis", async ({
  page,
  request,
}) => {
  const errors = watchErrors(page);
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/xml");
  const xml = await res.text();
  expect(xml).toContain("/produkt/weste-limmat-marine</loc>");
  expect(xml).toContain("/en/produkt/weste-limmat-marine</loc>");
  expect(xml).toContain("/kollektion/alle</loc>");
  expect(xml).toContain("/en/haeufige-fragen</loc>");
  expect(xml).not.toMatch(/warenkorb|konto|admin|merkliste|suche/);

  await open(page, "/en/haeufige-fragen");
  await expect(
    page.getByRole("heading", { level: 1, name: "Frequently asked questions" }),
  ).toBeVisible();
  await expect(page.getByText("Do I need an account?")).toBeVisible();
  await expect(page.locator(".language-note")).toHaveCount(0);

  await open(page, "/en/agb");
  await expect(page.locator(".language-note")).toContainText("Only the German version");
  await expect(page.getByRole("heading", { name: "6. Gift cards" })).toBeVisible();
  await open(page, "/en/datenschutz");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  await expect(page.getByText(/contact form/).first()).toBeVisible();

  await open(page, "/datenschutz");
  await expect(page.getByText(/Stripe Payments Europe, Limited/)).toBeVisible();
  await expect(page.getByText(/Shopify/)).toHaveCount(0);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("Kontaktformular: prüft Eingaben und schickt die Nachricht", async ({ page, request }) => {
  const errors = watchErrors(page);
  await open(page, "/kontakt");
  const form = page.locator(".contact-form");
  await form.getByRole("button", { name: "Nachricht senden" }).click();
  await expect(form.getByText("Bitte gib deinen Namen an.")).toBeVisible();
  await expect(form.getByText("Bitte schreib uns mindestens ein paar Worte.")).toBeVisible();
  await form.getByLabel("Name").fill("Max Muster");
  await form.getByLabel("E-Mail-Adresse").fill("max@example.ch");
  await form.getByLabel("Nachricht").fill("Gibt es den Anzug Limmat auch in Grösse 58?");
  await form.getByRole("button", { name: "Nachricht senden" }).click();
  await expect(page.getByText("Danke! Deine Nachricht ist bei uns.")).toBeVisible();
  const sent = (await fakeLog(request)).find((e) => e.path === "functions/contact");
  expect(sent?.body).toMatchObject({
    name: "Max Muster",
    email: "max@example.ch",
    message: "Gibt es den Anzug Limmat auch in Grösse 58?",
    locale: "de",
    website: "",
  });
  expect(errors, errors.join("\n")).toEqual([]);
});
