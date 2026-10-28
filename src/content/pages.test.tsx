import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { pages, type WrittenPage } from "./pages";
import { pagesEn } from "./pages-en";
import {
  InlineText,
  pageHasPlaceholder,
  visibleItems,
  resolvePageVariables,
} from "@/components/shop/written-content";

describe("Client page content", () => {
  it("keeps the five page structures and question groups", () => {
    expect(Object.keys(pages)).toHaveLength(5);
    expect(pages.datenschutz.sections).toHaveLength(11);
    expect(pages.agb.sections).toHaveLength(14);
    expect(pages["haeufige-fragen"].sections.map((s) => s.heading)).toEqual([
      "Grössen",
      "Bestellung und Konto",
      "Lieferung",
      "Rückgabe",
      "Zahlung, Gutscheine und Rabattcodes",
      "Newsletter",
      "Pflege",
    ]);
    expect(
      pages["haeufige-fragen"].sections
        .flatMap((s) => s.blocks)
        .filter((b) => b.type === "questions")
        .flatMap((b) => b.items),
    ).toHaveLength(19);
    expect(pages["versand-und-rueckgabe"].sections[0]?.blocks[0]?.type).toBe("definitions");
  });
  it("describes the real services (no Shopify), accounts, gift cards and newsletter", () => {
    const text = (handle: keyof typeof pages) => JSON.stringify(pages[handle]);
    for (const handle of Object.keys(pages) as (keyof typeof pages)[])
      expect(text(handle)).not.toMatch(/Shopify|Shop Pay|PayPal|Adyen/);
    for (const service of ["Stripe", "Supabase", "Resend", "Klarna", "Lovable", "Post"])
      expect(text("datenschutz")).toContain(service);
    for (const topic of ["Kundenkonto", "Geschenkgutschein", "Newsletter"]) {
      expect(text("datenschutz")).toContain(topic);
      expect(text("agb")).toContain(topic);
    }
  });
  it("interpolates only config values and preserves bracketed copy", () => {
    expect(resolvePageVariables("{{brand}} {{returnDays}} [Datum] {{email}}")).toBe(
      "Axion 14 [Datum] [E-Mail-Adresse]",
    );
    const html = renderToStaticMarkup(<InlineText text="[Datenschutz-E-Mail, sonst {{email}}]" />);
    expect(html).toContain('class="placeholder"');
    expect(html).toContain('href="mailto:[E-Mail-Adresse]"');
    expect(html).not.toContain("{{email}}");
    expect(html.replace(/<[^>]*>/g, "")).toBe("[Datenschutz-E-Mail, sonst [E-Mail-Adresse]]");
  });
  it("automatically removes draft status when no placeholders remain", () => {
    expect(Object.values(pages).every(pageHasPlaceholder)).toBe(true);
    expect(
      pageHasPlaceholder({
        title: "Fertig",
        sections: [{ blocks: [{ type: "paragraph", text: "Bestätigte Angaben." }] }],
      }),
    ).toBe(false);
    expect(
      pageHasPlaceholder({
        title: "Kontakt",
        sections: [{ blocks: [{ type: "paragraph", text: "{{email}}" }] }],
      }),
    ).toBe(true);
  });
  it("renders formatting, line breaks and external links without changing text", () => {
    const html = renderToStaticMarkup(
      <InlineText text={"**Kontakt**\n`__cf_bm` https://stripe.com/ch/privacy. flowrenix.com"} />,
    );
    expect(html).toContain("<strong>Kontakt</strong><br/>");
    expect(html).toContain('<span class="inline-code">__cf_bm</span>');
    expect(html).toContain('href="https://stripe.com/ch/privacy" target="_blank" rel="noopener"');
    expect(html).toContain('href="https://flowrenix.com"');
  });
});
describe("English pages", () => {
  // Gleicher Aufbau wie Deutsch: gleiche Abschnitte, Blockarten und Anzahl Punkte (beide Sprachen im Gleichschritt).
  const shape = (page: WrittenPage) =>
    page.sections.map((s) =>
      s.blocks.map((b) => `${b.type}:${"items" in b ? b.items.length : 1}`).join(","),
    );

  it("has every written page, including the legal texts, with the same structure as German", () => {
    for (const handle of Object.keys(pages) as (keyof typeof pages)[]) {
      const en = pagesEn[handle];
      expect(en, handle).toBeDefined();
      expect(shape(en!), handle).toEqual(shape(pages[handle]));
    }
  });

  it("keeps the client placeholders and config variables", () => {
    for (const handle of ["impressum", "datenschutz", "agb"] as const) {
      const de = JSON.stringify(pages[handle]);
      const en = JSON.stringify(pagesEn[handle]);
      expect(pageHasPlaceholder(pagesEn[handle]!), handle).toBe(true);
      for (const v of de.match(/\{\{\w+\}\}/g) ?? []) expect(en, `${handle} ${v}`).toContain(v);
    }
  });

  it("names the contact form in the privacy policy (German and English)", () => {
    expect(JSON.stringify(pages.datenschutz)).toContain("Kontaktformular");
    expect(JSON.stringify(pagesEn.datenschutz)).toContain("contact form");
  });

  it("explains the abuse counters (hash only, deleted after about two days)", () => {
    expect(JSON.stringify(pages.datenschutz)).toContain("nur ein Prüfwert (Hash)");
    expect(JSON.stringify(pagesEn.datenschutz)).toContain("only a hash of the address");
  });
});

describe("Besucherstatistik im Datenschutztext", () => {
  const bullets = (page: WrittenPage) =>
    page.sections.flatMap((s) => s.blocks).flatMap((b) => (b.type === "bullets" ? b.items : []));
  it("steht in beiden Sprachen und erscheint nur bei eingeschalteter Statistik", () => {
    for (const page of [pages.datenschutz, pagesEn.datenschutz!]) {
      const marked = bullets(page).filter((t) => t.startsWith("{{analytics}}"));
      expect(marked).toHaveLength(1);
      expect(visibleItems(marked, false)).toEqual([]);
      expect(visibleItems(marked, true)[0]).not.toContain("{{analytics}}");
      expect(visibleItems(marked, true)[0]).toContain("Plausible");
    }
  });
});
