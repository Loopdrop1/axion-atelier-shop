import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/commerce/seo";
import { CartContents } from "@/components/shop/cart";
export const Route = createFileRoute("/warenkorb")({
  head: () =>
    pageHead(
      "Dein Warenkorb",
      "Deine ausgewählten Stücke von Axion. Gratisversand in der Schweiz.",
    ),
  component: CartPage,
});
function CartPage() {
  return (
    <div className="container page-body">
      <p className="eyebrow">Deine Auswahl</p>
      <h1 className="page-title">Dein Warenkorb</h1>
      <CartContents page />
    </div>
  );
}
