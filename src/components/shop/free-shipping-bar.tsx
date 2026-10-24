import { formatCents } from "@/lib/commerce/format";
import { freeShippingProgress } from "@/lib/commerce/shipping-text";
import type { ShopSettings } from "@/lib/commerce/source";
import { useLocale, useT } from "@/i18n";

/** Fortschritt bis «Gratisversand ab» aus den Einstellungen. Wie die Kasse: Zwischenbetrag minus Rabatt.
 *  Ohne Schwelle oder bei Gratisversand nichts. */
export function FreeShippingBar({
  subtotalCents,
  discountCents = 0,
  settings,
}: {
  subtotalCents: number;
  discountCents?: number;
  settings: Pick<ShopSettings, "shippingCents" | "freeShippingFromCents">;
}) {
  const t = useT();
  const locale = useLocale();
  const progress = freeShippingProgress(subtotalCents, discountCents, settings);
  if (!progress) return null;
  return (
    <div className="free-shipping" role="status">
      <p>
        {progress.leftCents > 0
          ? t.checkout.freeShippingLeft(formatCents(progress.leftCents, locale))
          : t.checkout.freeShippingReached}
      </p>
      <div className="free-shipping-track" aria-hidden="true">
        <span style={{ transform: `scaleX(${progress.ratio})` }} />
      </div>
    </div>
  );
}
