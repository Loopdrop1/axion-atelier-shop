import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/commerce/stores";
import { resolveCart, type Cart as CartType } from "@/lib/commerce";
import { formatPrice } from "@/lib/commerce/format";
import { Photo } from "./primitives";
export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p className="text-muted">{text}</p>
      <div className="empty-links">
        <Button asChild>
          <Link to="/kollektion/$handle" params={{ handle: "alle" }}>
            Kollektion entdecken
          </Link>
        </Button>
      </div>
    </div>
  );
}
export function CartContents({
  page = false,
  onNavigate,
}: {
  page?: boolean;
  onNavigate?: () => void;
}) {
  const { lines, quantity, remove } = useCart();
  const [cart, setCart] = useState<CartType | null>(null);
  useEffect(() => {
    let live = true;
    resolveCart(lines).then((c) => {
      if (live) setCart(c);
    });
    return () => {
      live = false;
    };
  }, [lines]);
  if (!cart) return <p>Warenkorb wird geladen …</p>;
  if (!cart.lines.length)
    return (
      <EmptyState
        title="Dein Warenkorb ist noch leer"
        text="Finde die Stücke, die zu deinem Auftritt passen."
      />
    );
  return (
    <div className={page ? "cart-layout" : ""}>
      <div>
        {cart.lines.map((l) => (
          <div className="cart-line" key={l.variantId}>
            <Link to="/produkt/$handle" params={{ handle: l.product.handle }} onClick={onNavigate}>
              <Photo image={l.product.images[0]} />
            </Link>
            <div className="cart-line-info">
              <Link
                to="/produkt/$handle"
                params={{ handle: l.product.handle }}
                onClick={onNavigate}
              >
                <h3>{l.product.title}</h3>
              </Link>
              <p>
                {l.product.color.name} · Grösse {l.variant.title}
              </p>
              <span className="price">{formatPrice(l.variant.price)}</span>
              <div className="cart-line-controls">
                <div className="stepper">
                  <Button
                    variant="icon"
                    aria-label="Anzahl reduzieren"
                    onClick={() => quantity(l.variantId, l.quantity - 1)}
                  >
                    <Minus />
                  </Button>
                  <span>{l.quantity}</span>
                  <Button
                    variant="icon"
                    aria-label="Anzahl erhöhen"
                    onClick={() => quantity(l.variantId, l.quantity + 1)}
                  >
                    <Plus />
                  </Button>
                </div>
                <Button
                  variant="icon"
                  size="icon"
                  aria-label={`${l.product.title} entfernen`}
                  onClick={() => remove(l.variantId)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="cart-summary" aria-live="polite">
        <p>
          <span>Zwischensumme</span>
          <span className="price">{formatPrice(cart.subtotal)}</span>
        </p>
        <p className="text-muted">
          <span>Versand</span>
          <span>gratis</span>
        </p>
        <Button disabled={!cart.checkoutUrl}>Zur Kasse</Button>
        <span className="checkout-note">Die Kasse wird beim Livegang verbunden.</span>
        {!page && (
          <Link className="text-link" to="/warenkorb" onClick={onNavigate}>
            Warenkorb ansehen
          </Link>
        )}
      </div>
    </div>
  );
}
