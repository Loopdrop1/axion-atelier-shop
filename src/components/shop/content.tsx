import { Link } from "@tanstack/react-router";
import { pages, type WrittenPageHandle } from "@/content/pages";
import { pagesEn } from "@/content/pages-en";
import { WrittenContent } from "./written-content";
import { shopConfig } from "@/config/shop";
import { SizeGuide } from "./size-guide";
import { ContactForm } from "./contact-form";
import { Photo } from "./primitives";
import type { ShopImage } from "@/lib/commerce";
import { messages, useLocale, useLocaleParam, useT, type Locale } from "@/i18n";

export const contentHandles = [
  "ueber-uns",
  "haeufige-fragen",
  "kontakt",
  "groessenberatung",
  "versand-und-rueckgabe",
  "impressum",
  "datenschutz",
  "agb",
] as const;
export type ContentHandle = (typeof contentHandles)[number];

/** Rechtstexte: Auf Englisch steht ein Hinweis, dass die deutsche Fassung massgebend ist. */
const LEGAL = new Set<ContentHandle>(["impressum", "datenschutz", "agb"]);

/** Titel und Beschreibung einer Inhaltsseite in der gewünschten Sprache (für head). */
export function contentMeta(handle: ContentHandle, locale: Locale) {
  return messages[locale].pages[handle];
}

export function ContentPage({ handle, image }: { handle: ContentHandle; image?: ShopImage }) {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const meta = t.pages[handle];
  const writtenHandle = handle in pages ? (handle as WrittenPageHandle) : undefined;
  const translated = writtenHandle && locale === "en" ? pagesEn[writtenHandle] : undefined;
  const written = writtenHandle ? (translated ?? pages[writtenHandle]) : undefined;
  const germanFallback = Boolean(writtenHandle && locale === "en" && !translated);
  const placeholder = <div className="placeholder-box">{t.content.placeholder}</div>;
  return (
    <article className="container page-body content-page">
      <p className="eyebrow">{t.content.eyebrow}</p>
      <h1>{germanFallback ? meta.title : written?.title || meta.title}</h1>
      {germanFallback && (
        <p className="language-note" lang="en">
          {t.language.englishLegalNote}
        </p>
      )}
      {translated && LEGAL.has(handle) && (
        <p className="language-note" lang="en">
          {t.language.legalTranslationNote}
        </p>
      )}
      {written ? (
        <div lang={germanFallback ? "de-CH" : undefined}>
          <WrittenContent page={written} />
        </div>
      ) : handle === "ueber-uns" ? (
        <>
          {image && <Photo image={image} />}
          <h2>{t.content.about.title}</h2>
          <p>{t.content.about.text}</p>
          {placeholder}
          <Link
            className="text-link"
            to="/{-$locale}/kollektion/$handle"
            params={{ locale: lp, handle: "alle" }}
          >
            {t.common.discoverCollection}
          </Link>
        </>
      ) : handle === "groessenberatung" ? (
        <SizeGuide />
      ) : handle === "kontakt" ? (
        <>
          <p>{t.content.contact.intro}</p>
          <ContactForm />
          <h2>{t.content.contact.title}</h2>
          <p>
            <a href={`mailto:${shopConfig.contact.email}`}>{shopConfig.contact.email}</a>
            {shopConfig.contact.phone && (
              <>
                <br />
                <a href={`tel:${shopConfig.contact.phone.replace(/[^\d+]/g, "")}`}>
                  {shopConfig.contact.phone}
                </a>
              </>
            )}
            {/* Freiwillig: solange hier noch ein Platzhalter in [Klammern] steht, bleibt die Zeile weg */}
            {shopConfig.contact.hours && !/\[[^\]]*\]/.test(shopConfig.contact.hours) && (
              <>
                <br />
                {t.content.contact.hours}: {shopConfig.contact.hours}
              </>
            )}
          </p>
        </>
      ) : null}
    </article>
  );
}
