import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { shopConfig } from "@/config/shop";
import { useLocaleParam, useT } from "@/i18n";
import { useShopUI } from "@/lib/commerce/stores";
import { Logo } from "./logo";
import { Panel } from "./primitives";
import { CartContents } from "./cart";
import { SearchOverlay } from "./search";
import { LanguageSwitch } from "./language-switch";
import { occasionHandles } from "./nav-handles";

/** Warenkorb, Menü (Telefon) und Suche: erst nach dem Öffnen nötig, deshalb getrennt vom Rahmen geladen. */
export default function ShellOverlays({
  categories,
  wishes,
}: {
  categories: { handle: string; title: string }[];
  wishes: number;
}) {
  const t = useT();
  const lp = useLocaleParam();
  const { cartOpen, setCart, menuOpen, setMenu } = useShopUI();
  const label = (handle: string) => t.nav.labels[handle] ?? handle;
  return (
    <>
      <Panel open={cartOpen} onOpenChange={setCart} title={t.cart.title}>
        <CartContents onNavigate={() => setCart(false)} />
      </Panel>
      <Panel open={menuOpen} onOpenChange={setMenu} title={<Logo />} kind="menu">
        <nav className="menu-links" aria-label={t.nav.mobile}>
          {[
            { handle: "neu", title: label("neu") },
            ...categories,
            { handle: "alle", title: label("alle") },
            { handle: "sale", title: label("sale") },
          ].map((c, i) => (
            <motion.div
              key={c.handle}
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Link
                to="/{-$locale}/kollektion/$handle"
                params={{ locale: lp, handle: c.handle }}
                onClick={() => setMenu(false)}
              >
                {c.title}
              </Link>
            </motion.div>
          ))}
        </nav>
        <nav className="menu-secondary">
          {occasionHandles.map((o) => (
            <Link
              key={o}
              to="/{-$locale}/kollektion/$handle"
              params={{ locale: lp, handle: "alle" }}
              search={{ anlass: o }}
              onClick={() => setMenu(false)}
            >
              {t.occasions[o]}
            </Link>
          ))}
          {shopConfig.features.customerAccounts && (
            <Link to="/{-$locale}/konto" params={{ locale: lp }} onClick={() => setMenu(false)}>
              {t.nav.account}
            </Link>
          )}
          <Link to="/{-$locale}/merkliste" params={{ locale: lp }} onClick={() => setMenu(false)}>
            {t.nav.wishlist} ({t.common.pieces(wishes)})
          </Link>
          {shopConfig.features.giftCards && (
            <Link
              to="/{-$locale}/geschenkgutschein"
              params={{ locale: lp }}
              onClick={() => setMenu(false)}
            >
              {t.nav.giftCards}
            </Link>
          )}
          <Link to="/{-$locale}/ueber-uns" params={{ locale: lp }} onClick={() => setMenu(false)}>
            {t.nav.about}
          </Link>
          <LanguageSwitch className="menu-language" onNavigate={() => setMenu(false)} />
        </nav>
      </Panel>
      <SearchOverlay />
    </>
  );
}
