import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { pages } from "./pages";
import {
  InlineText,
  pageHasPlaceholder,
  resolvePageVariables,
} from "@/components/shop/written-content";

describe("Client page content", () => {
  it("keeps the five page structures and question groups", () => {
    expect(Object.keys(pages)).toHaveLength(5);
    expect(pages.datenschutz.sections).toHaveLength(11);
    expect(pages.agb.sections).toHaveLength(12);
    expect(pages["haeufige-fragen"].sections.map((s) => s.heading)).toEqual([
      "Grössen",
      "Lieferung",
      "Rückgabe",
      "Zahlung",
      "Pflege",
    ]);
    expect(
      pages["haeufige-fragen"].sections
        .flatMap((s) => s.blocks)
        .filter((b) => b.type === "questions")
        .flatMap((b) => b.items),
    ).toHaveLength(12);
    expect(pages["versand-und-rueckgabe"].sections[0]?.blocks[0]?.type).toBe("definitions");
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
      <InlineText
        text={"**Kontakt**\n`__cf_bm` https://www.shopify.com/legal/privacy. flowrenix.com"}
      />,
    );
    expect(html).toContain("<strong>Kontakt</strong><br/>");
    expect(html).toContain('<span class="inline-code">__cf_bm</span>');
    expect(html).toContain(
      'href="https://www.shopify.com/legal/privacy" target="_blank" rel="noopener"',
    );
    expect(html).toContain('href="https://flowrenix.com"');
  });
});