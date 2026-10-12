import { useEffect, useState, useRef, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Heart, ShoppingBag, Menu, ChevronDown, User } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { shopConfig } from "@/config/shop";
import { useCart, useWishlist, useShopUI } from "@/lib/commerce/stores";
import { announcementsQuery, navQuery } from "@/lib/commerce/queries";
import { useLocaleLoaderData } from "@/lib/commerce/locale-data";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { Logo } from "./logo";
import * as Popover from "@radix-ui/react-popover";
import { Panel } from "./primitives";
import { CartContents } from "./cart";
import { SearchOverlay } from "./search";
import { LanguageSwitch } from "./language-switch";
import { NewsletterForm } from "./newsletter-form";

/** Standardmenü, solange die Kategorien aus dem Admin noch nicht geladen sind (z. B. Vorschau ohne Backend). */
const defaultCategories = ["anzuege", "westen", "schuhe"] as const;
/** Im Kopfmenü am Computer höchstens so viele Kategorien; die übrigen über «Alle Stücke». */
const DESKTOP_MAX = 5;
export const occasionHandles = ["hochzeit", "business", "abschlussfeier", "gala"] as const;
const helpPages = [
  "versand-und-rueckgabe",
  "groessenberatung",
  "haeufige-fragen",
  "kontakt",
] as const;
const legalPages = ["impressum", "datenschutz", "agb"] as const;

export function ShopShell({ children }: { children: ReactNode }) {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const home = pathname === "/" || pathname === "/en" || pathname === "/en/";
  const header = useRef<HTMLElement>(null);
  const [occasionOpen, setOccasionOpen] = useState(false);
  const [headerTop, setHeaderTop] = useState<number | null>(null);
  const [scroll, setScroll] = useState({ solid: false, hidden: false });
  const [announcement, setAnnouncement] = useState(0);
  const initialAnnouncements = useLocaleLoaderData()?.announcements;
  const { data: announcements = t.announcements } = useQuery({
    ...announcementsQuery(locale),
    ...(initialAnnouncements ? { initialData: initialAnnouncements } : {}),
  });

  const { cartOpen, setCart, menuOpen, setMenu, setSearch } = useShopUI();
  const count = useCart((s) => s.lines.reduce((a, l) => a + l.quantity, 0));
  const wishes = useWishlist((s) => s.handles.length);
  const label = (handle: string) => t.nav.labels[handle] ?? handle;
  const categories = useNavCategories();
  const desktop = categories.slice(0, DESKTOP_MAX);
  const more = categories.length > DESKTOP_MAX;
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
      const announcementHeight =
        document.querySelector(".announcement")?.getBoundingClientRect().height ?? 32;
      const top = Math.max(0, announcementHeight - y);
      const direction = y - last;
      const hidden =
        y > 180 &&
        (direction > 0 ||
          (direction === 0 && header.current?.classList.contains("hidden-header") === true));
      setHeaderTop(top);
      setScroll({ solid: y > 40, hidden });
      document.documentElement.style.setProperty(
        "--filter-header-offset",
        hidden ? "0px" : `${(header.current?.offsetHeight ?? 88) + top}px`,
      );
      last = y;
    };
    update();
    const resize = new ResizeObserver(update);
    if (header.current) resize.observe(header.current);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      resize.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, []);
  useEffect(() => {
    if (announcements.length < 2) return;
    const timer = window.setInterval(
      () => setAnnouncement((n) => (n + 1) % announcements.length),
      6500,
    );
    return () => clearInterval(timer);
  }, [announcements.length]);
  useEffect(() => {
    setMenu(false);
    setOccasionOpen(false);
    setScroll((s) => ({ ...s, hidden: false }));
  }, [pathname, setMenu]);
  return (
    <>
      <a href="#main-content" className="skip-link">
        {t.common.skipToContent}
      </a>
      <div className="announcement">
        <span key={`${locale}-${announcement}`}>
          {announcements[announcement % announcements.length]}
        </span>
      </div>
      <header
        ref={header}
        style={headerTop === null ? undefined : { top: headerTop }}
        className={`site-header ${!home || scroll.solid ? "solid" : ""} ${scroll.hidden ? "hidden-header" : ""}`}
      >
        <div className="container header-inner">
          <Button
            variant="icon"
            size="icon"
            className="mobile-menu-toggle"
            aria-label={t.nav.openMenu}
            onClick={() => setMenu(true)}
          >
            <Menu />
          </Button>
          <Link
            to="/{-$locale}"
            params={{ locale: lp }}
            className="header-logo"
            aria-label={t.nav.home}
          >
            <Logo />
          </Link>
          <nav className="desktop-nav" aria-label={t.nav.main}>
            {[{ handle: "neu", title: label("neu") }, ...desktop].map((c) => (
              <Link
                key={c.handle}
                to="/{-$locale}/kollektion/$handle"
                params={{ locale: lp, handle: c.handle }}
              >
                {c.title}
              </Link>
            ))}
            {more && (
              <Link to="/{-$locale}/kollektion/$handle" params={{ locale: lp, handle: "alle" }}>
                {label("alle")}
              </Link>
            )}
            <Popover.Root open={occasionOpen} onOpenChange={setOccasionOpen}>
              <Popover.Trigger asChild>
                <Button
                  variant="icon"
                  className="occasion-trigger"
                  aria-expanded={occasionOpen}
                  aria-controls="occasion-navigation"
                >
                  {t.nav.occasions} <ChevronDown />
                </Button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  id="occasion-navigation"
                  className="nav-popover"
                  align="start"
                  sideOffset={20}
                >
                  {occasionHandles.map((o) => (
                    <Link
                      key={o}
                      to="/{-$locale}/kollektion/$handle"
                      params={{ locale: lp, handle: "alle" }}
                      search={{ anlass: o }}
                      onClick={() => setOccasionOpen(false)}
                    >
                      {t.occasions[o]}
                    </Link>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
            <Link to="/{-$locale}/kollektion/$handle" params={{ locale: lp, handle: "sale" }}>
              {label("sale")}
            </Link>
          </nav>
          <div className="header-actions">
            <LanguageSwitch className="header-language" />
            <Button
              variant="icon"
              size="icon"
              aria-label={t.nav.openSearch}
              onClick={() => setSearch(true)}
            >
              <Search />
            </Button>
            {shopConfig.features.customerAccounts && (
              <Button variant="icon" size="icon" className="header-account" asChild>
                <Link to="/{-$locale}/konto" params={{ locale: lp }} aria-label={t.nav.account}>
                  <User />
                </Link>
              </Button>
            )}
            <Button variant="icon" size="icon" className="count-icon header-wishlist" asChild>
              <Link
                to="/{-$locale}/merkliste"
                params={{ locale: lp }}
                aria-label={t.nav.wishlistCount(wishes)}
              >
                <Heart />
                {wishes > 0 && <span className="count">{wishes}</span>}
              </Link>
            </Button>
            <Button
              variant="icon"
              size="icon"
              className="count-icon"
              aria-label={t.nav.openCart(count)}
              onClick={() => setCart(true)}
            >
              <ShoppingBag />
              {count > 0 && <span className="count">{count}</span>}
            </Button>
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
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
/** Aktive Kategorien aus dem Admin; bis sie geladen sind, das Standardmenü. */
function useNavCategories(): { handle: string; title: string }[] {
  const t = useT();
  const locale = useLocale();
  const initial = useLocaleLoaderData()?.nav;
  const { data } = useQuery({ ...navQuery(locale), ...(initial ? { initialData: initial } : {}) });
  return (
    data ?? defaultCategories.map((handle) => ({ handle, title: t.nav.labels[handle] ?? handle }))
  );
}

function Footer() {
  const t = useT();
  const lp = useLocaleParam();
  const categories = useNavCategories();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <Link
            to="/{-$locale}"
            params={{ locale: lp }}
            className="footer-brand"
            aria-label={t.nav.home}
          >
            <Logo vertical />
          </Link>
          <div className="footer-column">
            <h3>{t.footer.shop}</h3>
            {[{ handle: "neu", title: t.nav.labels["neu"] ?? "Neu" }, ...categories].map((c) => (
              <Link
                to="/{-$locale}/kollektion/$handle"
                params={{ locale: lp, handle: c.handle }}
                key={c.handle}
              >
                {c.title}
              </Link>
            ))}
            <Link to="/{-$locale}/kollektion/$handle" params={{ locale: lp, handle: "sale" }}>
              {t.nav.labels["sale"]}
            </Link>
            {shopConfig.features.giftCards && (
              <Link to="/{-$locale}/geschenkgutschein" params={{ locale: lp }}>
                {t.nav.giftCards}
              </Link>
            )}
            <Link to="/{-$locale}/ueber-uns" params={{ locale: lp }}>
              {t.nav.about}
            </Link>
          </div>
          <div className="footer-column">
            <h3>{t.footer.help}</h3>
            {helpPages.map((page) => (
              <Link to={`/{-$locale}/${page}` as const} params={{ locale: lp }} key={page}>
                {t.pages[page].title}
              </Link>
            ))}
            {shopConfig.features.customerAccounts && (
              <Link to="/{-$locale}/konto" params={{ locale: lp }}>
                {t.nav.account}
              </Link>
            )}
          </div>
          <div className="footer-column">
            <h3>{t.footer.legal}</h3>
            {legalPages.map((page) => (
              <Link to={`/{-$locale}/${page}` as const} params={{ locale: lp }} key={page}>
                {t.pages[page].title}
              </Link>
            ))}
            <LanguageSwitch className="footer-language" />
          </div>
        </div>
        {shopConfig.features.newsletter && (
          <div className="footer-newsletter">
            <div>
              <h3>{t.footer.newsletterTitle}</h3>
              <p>{t.footer.newsletterText}</p>
            </div>
            <NewsletterForm dark />
          </div>
        )}
        <div className="payment-badges">
          {shopConfig.paymentMethods.map((p) => (
            <span key={p}>{p}</span>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Axion</span>
          <a href="https://flowrenix.com" target="_blank" rel="noopener">
            {t.footer.madeBy}
          </a>
        </div>
      </div>
    </footer>
  );
}
