// Abschnitt «Bewertungen» der Produktseite: Durchschnitt, Anzahl und freigegebene Bewertungen echter Käufe.
// Eigener Teil (lazy in product.tsx), nur mit shopConfig.features.reviews. Liefert die Datenbank null (Schalter im
// Admin aus oder Muster-Produkt), bleibt der Abschnitt ganz weg.
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { htmlLang, useLocale, useT } from "@/i18n";
import { formatDate } from "@/lib/commerce/format";
import { productReviewsQuery } from "@/lib/commerce/queries";
import type { ProductReviews } from "@/lib/commerce";

/** Sterne als Bild mit Text für Screenreader (ganze Sterne; der Durchschnitt steht zusätzlich als Zahl daneben). */
export function Stars({ value, label }: { value: number; label: string }) {
  const full = Math.round(value);
  return (
    <span className="review-stars" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden="true" size={16} className={n <= full ? "is-on" : undefined} />
      ))}
    </span>
  );
}

export function ProductReviewsSection({
  handle,
  initial,
}: {
  handle: string;
  initial: ProductReviews | null;
}) {
  const t = useT();
  const locale = useLocale();
  const r = t.reviews;
  const query = useQuery({
    ...productReviewsQuery(handle),
    ...(initial ? { initialData: initial } : {}),
  });
  const data = query.data;
  if (!data) return null;
  const average = data.average === null ? null : data.average.toFixed(1);
  const averageText = average === null ? "" : locale === "en" ? average : average.replace(".", ",");
  return (
    <section className="section pb-0 product-reviews" aria-labelledby="reviews-title">
      <div className="section-head">
        <h2 id="reviews-title">{r.title}</h2>
      </div>
      {data.count > 0 && average !== null ? (
        <p className="review-summary">
          <Stars value={data.average ?? 0} label={r.average(averageText, data.count)} />
          <span aria-hidden="true">
            {averageText} · {data.count}
          </span>
        </p>
      ) : (
        <p className="text-muted">{r.none}</p>
      )}
      {data.items.length > 0 && (
        <ul className="review-list">
          {data.items.map((item) => (
            <li key={item.id} className="review-item">
              <Stars value={item.rating} label={r.stars(item.rating)} />
              {item.title && <h3 lang={htmlLang(item.locale)}>{item.title}</h3>}
              <p className="review-body" lang={htmlLang(item.locale)}>
                {item.body}
              </p>
              <p className="review-meta">
                {item.displayName} · {r.verified}
                {item.date && <> · {formatDate(item.date, locale)}</>}
                {item.locale !== locale && <> · {r.otherLanguage}</>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
