// Grössentabellen aus dem Admin (Admin → Grössentabellen). Ohne passende Tabelle ein Hinweis statt Beispielwerten.
import { useQuery } from "@tanstack/react-query";
import { Link, useMatch } from "@tanstack/react-router";
import { shopConfig } from "@/config/shop";
import { sizeGuideQuery } from "@/lib/commerce/queries";
import { useLocale, useLocaleParam, useT } from "@/i18n";

/** category: Slug der Kategorie des Produkts; ohne Angabe alle Tabellen (Seite «Grössenberatung»). */
export function SizeGuide({ category }: { category?: string }) {
  const t = useT().sizeGuide;
  const locale = useLocale();
  const lp = useLocaleParam();
  // Auf der Seite «Grössenberatung» kommen die Tabellen vom Server mit (sonst Unterschied beim Hydrieren).
  const initial = useMatch({
    from: "/{-$locale}/groessenberatung",
    shouldThrow: false,
  })?.loaderData;
  const { data: tables = [], isLoading } = useQuery({
    ...sizeGuideQuery(locale),
    ...(initial ? { initialData: initial } : {}),
  });
  const shown = category
    ? tables.filter((tb) => tb.categories.length === 0 || tb.categories.includes(category))
    : tables;
  if (isLoading) return null;
  return (
    <>
      {shown.length === 0 && <p>{t.missing}</p>}
      {shown.map((tb) => (
        <section key={tb.id} className="size-guide">
          {tb.title && <h2>{tb.title}</h2>}
          <div className="table-scroll">
            <table className="size-table">
              <thead>
                <tr>
                  {tb.columns.map((c, i) => (
                    <th key={i} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tb.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, i) =>
                      i === 0 ? (
                        <th key={i} scope="row">
                          {cell}
                        </th>
                      ) : (
                        <td key={i}>{cell}</td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tb.note && <p className="size-notice">{tb.note}</p>}
        </section>
      ))}
      {/* Messanleitung passend zur Kategorie: Schuhe nur Fuss, Accessoires keine, Grössenberatung beides */}
      {category !== "accessoires" && (
        <p className="size-notice mt-6">
          {category === "schuhe"
            ? t.howToFeet
            : category
              ? t.howToBody
              : `${t.howToBody} ${t.howToFeet}`}
        </p>
      )}
      <p className="size-notice">
        <Link to="/{-$locale}/kontakt" params={{ locale: lp }}>
          {t.between}
        </Link>{" "}
        {t.exchange(shopConfig.returnDays)}
      </p>
    </>
  );
}
