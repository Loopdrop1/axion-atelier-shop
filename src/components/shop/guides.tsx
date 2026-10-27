// Ratgeber: Übersicht, Artikelseite und der kleine Verweisblock auf Kollektionsseiten.
// Die langen Texte (guides.ts, guides-en.ts) kommen aus dem Loader der Route; hier stehen nur Darstellung und Stammdaten.
import { Fragment, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Guide, GuideBlock } from "@/content/guides";
import {
  guideIndexMeta,
  guideMeta,
  guideSlugs,
  guidesFor,
  guidesUpdated,
  isGuideSlug,
  type GuideSlug,
} from "@/content/guides-meta";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { formatDate } from "@/lib/commerce/format";

type StaticPage = "groessenberatung" | "versand-und-rueckgabe" | "haeufige-fragen";
const STATIC_PAGES: readonly string[] = [
  "groessenberatung",
  "versand-und-rueckgabe",
  "haeufige-fragen",
];

/** Link auf eine Seite im Shop: Pfad ohne Sprachpräfix, z. B. «/kollektion/alle?anlass=hochzeit». */
export function GuideLink({
  path,
  children,
  className,
}: {
  path: string;
  children: ReactNode;
  className?: string;
}) {
  const lp = useLocaleParam();
  const [pathname = "", query = ""] = path.split("?");
  const segments = pathname.split("/").filter(Boolean);
  const [first, second] = segments;
  if (first === "kollektion" && second) {
    const anlass = new URLSearchParams(query).get("anlass") ?? undefined;
    return (
      <Link
        className={className}
        to="/{-$locale}/kollektion/$handle"
        params={{ locale: lp, handle: second }}
        search={anlass ? { anlass } : {}}
      >
        {children}
      </Link>
    );
  }
  if (first === "ratgeber" && second) {
    return (
      <Link
        className={className}
        to="/{-$locale}/ratgeber/$slug"
        params={{ locale: lp, slug: second }}
      >
        {children}
      </Link>
    );
  }
  if (first && STATIC_PAGES.includes(first)) {
    return (
      <Link
        className={className}
        to={`/{-$locale}/${first as StaticPage}` as const}
        params={{ locale: lp }}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link className={className} to="/{-$locale}" params={{ locale: lp }}>
      {children}
    </Link>
  );
}

/** Einfacher Text mit **fett** und [Beschriftung](/pfad). */
function GuideText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const token = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((\/[^)\s]*)\)/g;
  let position = 0;
  let match: RegExpExecArray | null;
  while ((match = token.exec(text))) {
    nodes.push(text.slice(position, match.index));
    nodes.push(
      <Fragment key={match.index}>
        {match[1] ? (
          <strong>{match[1]}</strong>
        ) : (
          <GuideLink path={match[3] ?? "/"}>{match[2]}</GuideLink>
        )}
      </Fragment>,
    );
    position = token.lastIndex;
  }
  nodes.push(text.slice(position));
  return <>{nodes}</>;
}

function Block({ block }: { block: GuideBlock }) {
  if (block.type === "paragraph")
    return (
      <p>
        <GuideText text={block.text} />
      </p>
    );
  return (
    <ul>
      {block.items.map((item, i) => (
        <li key={i}>
          <GuideText text={item} />
        </li>
      ))}
    </ul>
  );
}

/** Übersicht aller Ratgeber als Karten. */
export function GuideIndex() {
  const locale = useLocale();
  const t = useT();
  const meta = guideIndexMeta[locale];
  return (
    <div className="container page-body content-page">
      <p className="eyebrow">{t.guides.eyebrow}</p>
      <h1>{meta.title}</h1>
      <p className="guide-lead">{meta.intro}</p>
      <ul className="guide-cards">
        {guideSlugs.map((slug) => (
          <li key={slug}>
            <GuideLink path={`/ratgeber/${slug}`} className="guide-card">
              <h2>{guideMeta[locale][slug].title}</h2>
              <p>{guideMeta[locale][slug].teaser}</p>
              <span className="guide-card-more">{t.guides.read}</span>
            </GuideLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ein Ratgeber: Einleitung, «Kurz gesagt», Abschnitte, Fragen, weiterführende Links. */
export function GuidePage({ slug, guide }: { slug: GuideSlug; guide: Guide }) {
  const locale = useLocale();
  const lp = useLocaleParam();
  const t = useT();
  const meta = guideMeta[locale][slug];
  return (
    <article className="container page-body content-page guide">
      <nav className="breadcrumb" aria-label={t.product.breadcrumb}>
        <Link to="/{-$locale}" params={{ locale: lp }}>
          {t.product.home}
        </Link>
        <span>/</span>
        <Link to="/{-$locale}/ratgeber" params={{ locale: lp }}>
          {t.guides.navLabel}
        </Link>
      </nav>
      <p className="eyebrow">{t.guides.eyebrow}</p>
      <h1>{meta.title}</h1>
      <p className="guide-updated">
        {t.guides.updated} <time dateTime={guidesUpdated}>{formatDate(guidesUpdated, locale)}</time>
      </p>
      <div className="written-content guide-body">
        <p className="guide-lead">{guide.intro}</p>
        <aside className="guide-summary" aria-labelledby="guide-summary-title">
          <h2 id="guide-summary-title">{t.guides.summaryTitle}</h2>
          <ul>
            {guide.summary.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </aside>
        {guide.sections.map((section, i) => (
          <section key={i}>
            <h2>{section.heading}</h2>
            {section.blocks.map((block, j) => (
              <Block key={j} block={block} />
            ))}
          </section>
        ))}
        <section className="guide-faq">
          <h2>{t.guides.faqTitle}</h2>
          {guide.faq.map((item, i) => (
            <div key={i}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </div>
          ))}
        </section>
        <section className="guide-related">
          <h2>{t.guides.relatedTitle}</h2>
          <ul className="guide-link-list">
            {guide.related.map((link) => (
              <li key={link.path}>
                <GuideLink path={link.path} className="text-link">
                  {link.label}
                </GuideLink>
              </li>
            ))}
          </ul>
        </section>
        <section className="guide-more">
          <h2>{t.guides.moreTitle}</h2>
          <ul className="guide-link-list">
            {guideSlugs
              .filter((other) => other !== slug)
              .map((other) => (
                <li key={other}>
                  <GuideLink path={`/ratgeber/${other}`} className="text-link">
                    {guideMeta[locale][other].title}
                  </GuideLink>
                </li>
              ))}
          </ul>
        </section>
      </div>
    </article>
  );
}

/** Kleiner Verweisblock unter den Produkten einer Kollektion oder eines Anlasses. */
export function GuideLinks({
  handle,
  occasion,
}: {
  handle: string;
  occasion?: string | undefined;
}) {
  const locale = useLocale();
  const t = useT();
  const slugs = guidesFor(handle, occasion).filter(isGuideSlug);
  if (!slugs.length) return null;
  return (
    <nav className="guide-links" aria-labelledby="guide-links-title">
      <h2 id="guide-links-title">{t.guides.navLabel}</h2>
      <ul>
        {slugs.map((slug) => (
          <li key={slug}>
            <GuideLink path={`/ratgeber/${slug}`} className="text-link">
              {guideMeta[locale][slug].title}
            </GuideLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
