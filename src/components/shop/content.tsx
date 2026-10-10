import { Link } from "@tanstack/react-router";
import { pages } from "@/content/pages";
import { WrittenContent } from "./written-content";
import { shopConfig } from "@/config/shop";
import { SizeGuide } from "./size-guide";
import { Photo } from "./primitives";
import type { ShopImage } from "@/lib/commerce";
export const contentPages = {
  "ueber-uns": {
    title: "Über uns",
    description: "Klare Schnitte und Stücke, die zusammenpassen. Entdecke Axion.",
  },
  "haeufige-fragen": {
    title: "Häufige Fragen",
    description: "Antworten zu Grössen, Lieferung, Rückgabe, Zahlung und Pflege bei Axion.",
  },
  kontakt: {
    title: "Kontakt",
    description: "So erreichst du Axion für deine Fragen zur Kollektion und Bestellung.",
  },
  groessenberatung: {
    title: "Grössenberatung",
    description: "Finde deine Grösse für Anzüge, Westen und Schuhe mit der Axion Grössentabelle.",
  },
  "versand-und-rueckgabe": {
    title: "Versand und Rückgabe",
    description: "Informationen zu Gratisversand in der Schweiz, Lieferung und Rückgabe bei Axion.",
  },
  impressum: {
    title: "Impressum",
    description: "Unternehmensangaben und Kontaktinformationen von Axion.",
  },
  datenschutz: {
    title: "Datenschutz",
    description: "Informationen zum Umgang mit deinen Daten im Axion Onlineshop.",
  },
  agb: {
    title: "Allgemeine Geschäftsbedingungen",
    description: "Die Geschäftsbedingungen für Bestellungen bei Axion.",
  },
} as const;
export type ContentHandle = keyof typeof contentPages;
const placeholder = <div className="placeholder-box">Inhalt folgt vor dem Livegang</div>;
export function ContentPage({ handle, image }: { handle: ContentHandle; image?: ShopImage }) {
  const data = contentPages[handle];
  const written = handle in pages ? pages[handle as keyof typeof pages] : undefined;
  return (
    <article className="container page-body content-page">
      <p className="eyebrow">Axion</p>
      <h1>{written?.title || data.title}</h1>
      {written ? <WrittenContent page={written} /> : handle === "ueber-uns" ? (
        <>
          {image && <Photo image={image} />}
          <h2>Klare Schnitte. Dein Auftritt.</h2>
          <p>
            Axion steht für klare Schnitte und Stücke, die zusammenpassen. Kombiniere Anzug, Weste
            und Schuhe zu deinem Auftritt.
          </p>
          {placeholder}
          <Link className="text-link" to="/kollektion/$handle" params={{ handle: "alle" }}>
            Kollektion entdecken
          </Link>
        </>
      ) : handle === "groessenberatung" ? (
        <SizeGuide />
      ) : handle === "kontakt" ? (
        <>
          <p>Hast du eine Frage zu einem Stück oder deiner Bestellung?</p>
          <h2>Schreib uns oder ruf an</h2>
          <p>
            <a href={`mailto:${shopConfig.contact.email}`}>{shopConfig.contact.email}</a>
            <br />
            <a href={`tel:${shopConfig.contact.phone}`}>{shopConfig.contact.phone}</a>
          </p>
          {placeholder}
        </>
      ) : null}
    </article>
  );
}
