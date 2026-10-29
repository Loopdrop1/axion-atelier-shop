// Link aus der Warenkorb-Erinnerung: /warenkorb/wiederherstellen/<Token> (mit /en davor auf Englisch).
// Legt die noch verfügbaren Stücke der abgebrochenen Bestellung in den Warenkorb und leitet zur Warenkorbseite weiter.
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/account/form";
import { useStoreHydrated } from "@/hooks/use-store-hydrated";
import { messages, toLocale, useLocale, useLocaleParam, useT } from "@/i18n";
import { resolveCart } from "@/lib/commerce";
import { pageHead } from "@/lib/commerce/seo";
import {
  applyRestore,
  fetchRestoreLines,
  planRestore,
  type RestoreOutcome,
} from "@/lib/commerce/restore-cart";
import { useCart } from "@/lib/commerce/stores";

export const Route = createFileRoute("/{-$locale}/warenkorb_/wiederherstellen/$token")({
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    const t = messages[locale].checkout.restore;
    return pageHead(t.title, t.description, "/warenkorb/wiederherstellen", locale, {
      noindex: true,
    });
  },
  component: Page,
});

function Page() {
  const { token } = Route.useParams();
  const t = useT();
  const r = t.checkout.restore;
  const locale = useLocale();
  const lp = useLocaleParam();
  const navigate = useNavigate();
  const hydrated = useStoreHydrated(useCart.persist);
  const started = useRef(false);
  const [outcome, setOutcome] = useState<RestoreOutcome | "error" | null>(null);

  // Erst nach dem Laden des gespeicherten Warenkorbs ergänzen, sonst würde dieser überschrieben.
  useEffect(() => {
    if (!hydrated || started.current) return;
    started.current = true;
    (async () => {
      try {
        const wanted = await fetchRestoreLines(token);
        if (wanted.length === 0) return setOutcome("invalid");
        const resolved = await resolveCart(wanted, locale);
        const plan = planRestore(wanted, resolved);
        setOutcome(
          applyRestore(
            wanted,
            plan,
            (id, qty, stock) => useCart.getState().add(id, qty, stock),
            (id) => useCart.getState().lines.find((l) => l.variantId === id)?.quantity ?? 0,
          ),
        );
      } catch {
        setOutcome("error");
      }
    })();
  }, [hydrated, token, locale]);

  const goCart = outcome === "done" || outcome === "partial";
  useEffect(() => {
    // Bei «partial» bleibt die Meldung stehen (WCAG 2.2.1); der Knopf führt zum Warenkorb.
    if (outcome !== "done") return;
    const timer = window.setTimeout(
      () =>
        void navigate({
          to: "/{-$locale}/warenkorb",
          params: { locale: lp },
          search: {},
          replace: true,
        }),
      1200,
    );
    return () => window.clearTimeout(timer);
  }, [goCart, outcome, lp, navigate]);

  const message =
    outcome === null
      ? r.working
      : outcome === "done"
        ? r.done
        : outcome === "partial"
          ? r.partial
          : outcome === "none"
            ? r.none
            : outcome === "invalid"
              ? r.invalid
              : r.error;
  return (
    <div className="container page-body account-narrow">
      <h1 className="page-title">{r.title}</h1>
      <Notice
        kind={outcome === "error" || outcome === "invalid" || outcome === "none" ? "error" : "info"}
      >
        {message}
      </Notice>
      <div className="empty-links justify-start">
        {goCart ? (
          <Button asChild>
            <Link to="/{-$locale}/warenkorb" params={{ locale: lp }}>
              {t.cart.title}
            </Link>
          </Button>
        ) : outcome ? (
          <Button asChild>
            <Link to="/{-$locale}" params={{ locale: lp }}>
              {t.common.toHome}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
