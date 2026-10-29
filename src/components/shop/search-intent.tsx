// Zeigt, was die Suche verstanden hat («Anzüge · Blau · bis CHF 700»), und lässt einzelne Begriffe entfernen.
import { X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { RelaxedCheck, SearchIntent, SearchResult } from "@/lib/commerce";
import { formatFrancs } from "@/lib/commerce/format";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { useFitLabel } from "./product-card";

interface IntentChip {
  key: string;
  label: string;
  /** Bedingung, die bei gelockerter Suche übergangen werden kann */
  check?: RelaxedCheck;
  /** Wörter, die beim Entfernen aus der Anfrage gestrichen werden */
  remove: (intent: SearchIntent) => SearchIntent;
}

function useIntentChips(intent: SearchIntent | undefined): IntentChip[] {
  const t = useT();
  const locale = useLocale();
  const fitLabel = useFitLabel();
  if (!intent) return [];
  const s = t.search;
  const chips: IntentChip[] = [];
  for (const c of intent.categories)
    chips.push({
      key: `c-${c}`,
      label: t.nav.labels[c] ?? c,
      remove: (i) => ({ ...i, categories: i.categories.filter((x) => x !== c) }),
    });
  for (const c of intent.colors)
    chips.push({
      key: `f-${c}`,
      check: "colors",
      label: s.colors[c] ?? c,
      remove: (i) => ({ ...i, colors: i.colors.filter((x) => x !== c) }),
    });
  for (const o of intent.occasions)
    chips.push({
      key: `o-${o}`,
      check: "occasions",
      label: t.occasions[o] ?? o,
      remove: (i) => ({ ...i, occasions: i.occasions.filter((x) => x !== o) }),
    });
  if (intent.fit)
    chips.push({
      key: "fit",
      check: "fit",
      label: fitLabel(intent.fit),
      remove: (i) => ({ ...i, fit: undefined }),
    });
  if (intent.size)
    chips.push({
      key: "size",
      check: "size",
      label: s.size(intent.size),
      remove: (i) => ({ ...i, size: undefined }),
    });
  if (intent.minPrice !== undefined)
    chips.push({
      key: "min",
      check: "minPrice",
      label: s.from(formatFrancs(intent.minPrice * 100, locale)),
      remove: (i) => ({ ...i, minPrice: undefined }),
    });
  if (intent.maxPrice !== undefined)
    chips.push({
      key: "max",
      check: "maxPrice",
      label: s.upTo(formatFrancs(intent.maxPrice * 100, locale)),
      remove: (i) => ({ ...i, maxPrice: undefined }),
    });
  if (intent.sale)
    chips.push({
      key: "sale",
      check: "sale",
      label: s.sale,
      remove: (i) => ({ ...i, sale: false }),
    });
  if (intent.neu)
    chips.push({ key: "neu", check: "neu", label: s.neu, remove: (i) => ({ ...i, neu: false }) });
  if (intent.cheap)
    chips.push({ key: "cheap", label: s.cheap, remove: (i) => ({ ...i, cheap: false }) });
  if (intent.gift)
    chips.push({ key: "gift", label: s.gift, remove: (i) => ({ ...i, gift: false }) });
  return chips;
}

export function IntentChips({
  intent,
  relaxed,
  onChange,
}: {
  intent: SearchIntent | undefined;
  /** Bedingungen, die die Suche nicht berücksichtigen konnte (gedimmt, mit Hinweis für Screenreader) */
  relaxed?: RelaxedCheck[] | undefined;
  onChange?: ((next: SearchIntent) => void) | undefined;
}) {
  const t = useT();
  const chips = useIntentChips(intent);
  if (!intent || !chips.length) return null;
  return (
    <div className="search-understood">
      <span>{t.search.understood}</span>
      {chips.map((chip) => {
        const ignored = Boolean(chip.check && relaxed?.includes(chip.check));
        const className = ignored ? "search-chip search-chip-ignored" : "search-chip";
        return onChange ? (
          <button
            type="button"
            key={chip.key}
            className={className}
            aria-label={`${t.search.remove(chip.label)}${ignored ? `, ${t.search.ignored}` : ""}`}
            onClick={() => onChange(chip.remove(intent))}
          >
            {chip.label}
            <X aria-hidden="true" />
          </button>
        ) : (
          <span key={chip.key} className={className}>
            {chip.label}
            {ignored && <span className="sr-only"> ({t.search.ignored})</span>}
          </span>
        );
      })}
    </div>
  );
}

/** Hinweise zur gelockerten Suche: Preisgrenze nicht erreicht, Sale-Absicht übergangen. */
export function RelaxedNotes({
  result,
  onNavigate,
}: {
  result: SearchResult | undefined;
  onNavigate?: (() => void) | undefined;
}) {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  if (!result?.relaxed || !result.products.length) return null;
  const checks = result.relaxedChecks ?? [];
  const { maxPrice } = result.intent;
  const cheapest = Math.min(...result.products.map((p) => p.priceRange.min.amount));
  return (
    <>
      <p className="search-note">{t.search.relaxed}</p>
      {checks.includes("terms") && result.intent.terms.length > 0 && (
        <p className="search-note">{t.search.notFound(result.intent.terms.join(", "))}</p>
      )}
      {checks.includes("maxPrice") && maxPrice !== undefined && (
        <p className="search-note">
          {t.search.noneUpTo(
            formatFrancs(maxPrice * 100, locale),
            formatFrancs(cheapest * 100, locale),
          )}
        </p>
      )}
      {checks.includes("sale") && (
        <p className="search-note">
          <Link
            to="/{-$locale}/kollektion/$handle"
            params={{ locale: lp, handle: "sale" }}
            onClick={onNavigate}
          >
            {t.search.saleLink}
          </Link>
        </p>
      )}
    </>
  );
}
