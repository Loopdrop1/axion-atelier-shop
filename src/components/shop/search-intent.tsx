// Zeigt, was die Suche verstanden hat («Anzüge · Blau · bis CHF 700»), und lässt einzelne Begriffe entfernen.
import { X } from "lucide-react";
import type { SearchIntent } from "@/lib/commerce";
import { formatFrancs } from "@/lib/commerce/format";
import { useLocale, useT } from "@/i18n";
import { useFitLabel } from "./product-card";

interface IntentChip {
  key: string;
  label: string;
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
      label: s.colors[c] ?? c,
      remove: (i) => ({ ...i, colors: i.colors.filter((x) => x !== c) }),
    });
  for (const o of intent.occasions)
    chips.push({
      key: `o-${o}`,
      label: t.occasions[o] ?? o,
      remove: (i) => ({ ...i, occasions: i.occasions.filter((x) => x !== o) }),
    });
  if (intent.fit)
    chips.push({
      key: "fit",
      label: fitLabel(intent.fit),
      remove: (i) => ({ ...i, fit: undefined }),
    });
  if (intent.size)
    chips.push({
      key: "size",
      label: s.size(intent.size),
      remove: (i) => ({ ...i, size: undefined }),
    });
  if (intent.minPrice !== undefined)
    chips.push({
      key: "min",
      label: s.from(formatFrancs(intent.minPrice * 100, locale)),
      remove: (i) => ({ ...i, minPrice: undefined }),
    });
  if (intent.maxPrice !== undefined)
    chips.push({
      key: "max",
      label: s.upTo(formatFrancs(intent.maxPrice * 100, locale)),
      remove: (i) => ({ ...i, maxPrice: undefined }),
    });
  if (intent.sale)
    chips.push({ key: "sale", label: s.sale, remove: (i) => ({ ...i, sale: false }) });
  if (intent.neu) chips.push({ key: "neu", label: s.neu, remove: (i) => ({ ...i, neu: false }) });
  if (intent.cheap)
    chips.push({ key: "cheap", label: s.cheap, remove: (i) => ({ ...i, cheap: false }) });
  if (intent.gift)
    chips.push({ key: "gift", label: s.gift, remove: (i) => ({ ...i, gift: false }) });
  return chips;
}

export function IntentChips({
  intent,
  onChange,
}: {
  intent: SearchIntent | undefined;
  onChange?: ((next: SearchIntent) => void) | undefined;
}) {
  const t = useT();
  const chips = useIntentChips(intent);
  if (!intent || !chips.length) return null;
  return (
    <div className="search-understood">
      <span>{t.search.understood}</span>
      {chips.map((chip) =>
        onChange ? (
          <button
            type="button"
            key={chip.key}
            className="search-chip"
            aria-label={t.search.remove(chip.label)}
            onClick={() => onChange(chip.remove(intent))}
          >
            {chip.label}
            <X aria-hidden="true" />
          </button>
        ) : (
          <span key={chip.key} className="search-chip">
            {chip.label}
          </span>
        ),
      )}
    </div>
  );
}
