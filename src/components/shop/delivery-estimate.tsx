import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { estimateDelivery, formatDelivery } from "@/lib/commerce/delivery";
import { useLocale } from "@/i18n";

/**
 * Voraussichtliches Lieferdatum. Das heutige Datum gibt es nur im Browser: Server und erste Darstellung
 * zeigen einen leeren Platzhalter gleicher Höhe, erst nach dem Einhängen erscheint der Text (kein Sprung).
 */
export function DeliveryEstimate({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const [text, setText] = useState("");
  useEffect(() => {
    setText(formatDelivery(estimateDelivery(new Date()), locale));
  }, [locale]);
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
