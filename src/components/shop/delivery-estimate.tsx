import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { deliveryConfigFor, estimateDelivery, formatDelivery } from "@/lib/commerce/delivery";
import type { ShippingMethod } from "@/lib/commerce/shipping-method";
import { useLocale } from "@/i18n";

/**
 * Voraussichtliches Lieferdatum. Das heutige Datum gibt es nur im Browser: Server und erste Darstellung
 * zeigen einen leeren Platzhalter gleicher Höhe, erst nach dem Einhängen erscheint der Text (kein Sprung).
 * Im Warenkorb folgt die Schätzung der gewählten Versandart (Priority: in der Regel am nächsten Arbeitstag).
 */
export function DeliveryEstimate({
  className = "",
  method = "economy",
}: {
  className?: string;
  method?: ShippingMethod;
}) {
  const locale = useLocale();
  const [text, setText] = useState("");
  useEffect(() => {
    setText(formatDelivery(estimateDelivery(new Date(), deliveryConfigFor(method)), locale));
  }, [locale, method]);
  return (
    <p className={`delivery-estimate ${className}`.trim()} data-ready={text ? "true" : "false"}>
      {text && (
        <>
          <Truck aria-hidden="true" size={15} strokeWidth={1.5} />
          <span>{text}</span>
        </>
      )}
    </p>
  );
}
