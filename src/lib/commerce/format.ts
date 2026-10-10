import type { Money } from "./types";
export const formatPrice = (value: Money | number) =>
  new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(
    typeof value === "number" ? value : value.amount,
  );
