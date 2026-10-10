import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Search, Heart, ShoppingBag, Menu, ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { shopConfig } from "@/config/shop";
import { useCart, useWishlist, useShopUI } from "@/lib/commerce/stores";
import { Logo } from "./logo";
import { Panel } from "./primitives";
import { CartContents } from "./cart";
import { SearchOverlay } from "./search";
export const navItems = [
  { label: "Neu", handle: "neu" },
  { label: "Anzüge", handle: "anzuege" },
  { label: "Westen", handle: "westen" },
  { label: "Schuhe", handle: "schuhe" },
];
export const occasions = [
  { label: "Hochzeit", handle: "hochzeit", text: "Für euren besonderen Tag." },
  { label: "Business", handle: "business", text: "Klar auftreten. Jeden Tag." },
  { label: "Abschlussfeier", handle: "abschlussfeier", text: "Ein neuer Abschnitt beginnt." },
  { label: "Gala", handle: "gala", text: "Für die grossen Abende." },
];
const help = [
  { label: "Versand und Rückgabe", to: "/versand-und-rueckgabe" },
  { label: "Grössenberatung", to: "/groessenberatung" },
  { label: "Häufige Fragen", to: "/haeufige-fragen" },
  { label: "Kontakt", to: "/kontakt" },
] as const;
const legal = [
  { label: "Impressum", to: "/impressum" },
  { label: "Datenschutz", to: "/datenschutz" },
  { label: "AGB", to: "/agb" },
] as const;
export function ShopShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const home = pathname === "/";
  const [scroll, setScroll] = useState({ solid: false, hidden: false });
  const [announcement, setAnnouncement] = useState(0);
  const reduced = useReducedMotion();
  const { cartOpen, setCart, menuOpen, setMenu, setSearch } = useShopUI();
  const count = useCart((s) => s.lines.reduce((a, l) => a + l.quantity, 0));
  const wishes = useWishlist((s) => s.handles.length);
  useEffect(() => {
    useCart.persist.rehydrate();
    useWishlist.persist.rehydrate();
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [setSearch]);
  useEffect(() => {
    let last = window.scrollY;
    const update = () => {
      const y = window.scrollY;
      setScroll({ solid: y > 40, hidden: y > 180 && y > last });
      last = y;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    const timer = window.setInterval(
      () => setAnnouncement((n) => (n + 1) % shopConfig.announcements.length),
      6500,
    );
    return () => {
      window.removeEventListener("scroll", update);
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    setMenu(false);
    setScroll((s) => ({ ...s, hidden: false }));
  }, [pathname, setMenu]);
  return (
    <>
      <div className="announcement">
        <span key={announcement}>{shopConfig.announcements[announcement]}</span>
      </div>
      <header
        className={`site-header ${!home || scroll.solid ? "solid" : ""} ${scroll.hidden ? "hidden-header" : ""}`}
      >
        <div className="container header-inner">
          <Button
            variant="icon"
            size="icon"
            className="mobile-menu-toggle"
            aria-label="Menü öffnen"
            onClick={() => setMenu(true)}
          >
            <Menu />
          </Button>
          <Link to="/" className="header-logo" aria-label="Axion Startseite">
            <Logo />
          </Link>
          <nav className="desktop-nav" aria-label="Hauptnavigation">
            {navItems.map((n) => (
              <Link key={n.handle} to="/kollektion/$handle" params={{ handle: n.handle }}>
                {n.label}
              </Link>
            ))}
            <div className="occasion-nav">
              <Button variant="icon" className="font-display text-sm" aria-haspopup="true">
                Anlässe <ChevronDown />
              </Button>
              <div className="occasion-dropdown">
                <div>
                  {occasions.map((o) => (
                    <Link
                      key={o.handle}
                      to="/kollektion/$handle"
                      params={{ handle: "alle" }}
                      search={{ anlass: o.handle }}
                    >
                      {o.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <Link to="/kollektion/$handle" params={{ handle: "sale" }}>
              Sale
            </Link>
          </nav>
          <div className="header-actions">
            <Button
              variant="icon"
              size="icon"
              aria-label="Suche öffnen"
              onClick={() => setSearch(true)}
            >
              <Search />
            </Button>
            <Button variant="icon" size="icon" className="count-icon header-wishlist" asChild>
              <Link to="/merkliste" aria-label={`Merkliste, ${wishes} Stücke`}>
                <Heart />
                {wishes > 0 && <span className="count">{wishes}</span>}
              </Link>
            </Button>
            <Button
              variant="icon"
              size="icon"
              className="count-icon"
              aria-label={`Warenkorb öffnen, ${count} Stücke`}
              onClick={() => setCart(true)}
            >
              <ShoppingBag />
              {count > 0 && <span className="count">{count}</span>}
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <Footer />
      <Panel open={cartOpen} onOpenChange={setCart} title="Dein Warenkorb">
        <CartContents onNavigate={() => setCart(false)} />
      </Panel>
      <Panel open={menuOpen} onOpenChange={setMenu} title="AXION" kind="menu">
        <nav className="menu-links" aria-label="Mobile Hauptnavigation">
          {[
            ...navItems,
            { label: "Alle Stücke", handle: "alle" },
            { label: "Sale", handle: "sale" },
          ].map((n, i) => (
            <motion.div
              key={n.handle}
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Link
                to="/kollektion/$handle"
                params={{ handle: n.handle }}
                onClick={() => setMenu(false)}
              >
                {n.label}
              </Link>
            </motion.div>
          ))}
        </nav>
        <nav className="menu-secondary">
          {occasions.map((o) => (
            <Link
              key={o.handle}
              to="/kollektion/$handle"
              params={{ handle: "alle" }}
              search={{ anlass: o.handle }}
              onClick={() => setMenu(false)}
            >
              {o.label}
            </Link>
          ))}
          <Link to="/merkliste" onClick={() => setMenu(false)}>
            Merkliste ({wishes})
          </Link>
          <Link to="/ueber-uns" onClick={() => setMenu(false)}>
            Über uns
          </Link>
        </nav>
      </Panel>
      <SearchOverlay />
    </>
  );
}
function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <Link to="/" className="footer-brand" aria-label="Axion Startseite">
            <Logo vertical />
          </Link>
          <div className="footer-column">
            <h3>Shop</h3>
            {navItems.map((n) => (
              <Link to="/kollektion/$handle" params={{ handle: n.handle }} key={n.handle}>
                {n.label}
              </Link>
            ))}
            <Link to="/kollektion/$handle" params={{ handle: "sale" }}>
              Sale
            </Link>
            <Link to="/ueber-uns">Über uns</Link>
          </div>
          <div className="footer-column">
            <h3>Hilfe</h3>
            {help.map((n) => (
              <Link to={n.to} key={n.to}>
                {n.label}
              </Link>
            ))}
          </div>
          <div className="footer-column">
            <h3>Rechtliches</h3>
            {legal.map((n) => (
              <Link to={n.to} key={n.to}>
                {n.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="payment-badges">
          {shopConfig.paymentMethods.map((p) => (
            <span key={p}>{p}</span>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© 2026 Axion</span>
          <a href="https://flowrenix.com" target="_blank" rel="noopener">
            Made by Flowrenix.com
          </a>
        </div>
      </div>
    </footer>
  );
}
