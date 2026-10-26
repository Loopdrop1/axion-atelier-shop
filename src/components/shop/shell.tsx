import { lazy, Suspense, useEffect, useState, useRef, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Heart,
  ShoppingBag,
  Menu,
  ChevronDown,
  User,
  Pause,
  Play,
  Instagram,
  Facebook,
  Linkedin,
} from "lucide-react";
import { socialChannels } from "@/lib/seo/structured";
import { Button } from "@/components/ui/button";
import { shopConfig } from "@/config/shop";
import { useCart, useRecentlyViewed, useWishlist, useShopUI } from "@/lib/commerce/stores";
import { announcementsQuery, navQuery } from "@/lib/commerce/queries";
import { defaultAnnouncements } from "@/lib/commerce/shipping-text";
import { useShopSettings } from "@/lib/commerce/use-settings";
import { useLocaleLoaderData } from "@/lib/commerce/locale-data";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { Logo } from "./logo";
import * as Popover from "@radix-ui/react-popover";
import { LanguageSwitch } from "./language-switch";
import { NewsletterForm } from "./newsletter-form";
import { WishlistSync } from "./wishlist-sync";
import { occasionHandles } from "./nav-handles";

export { occasionHandles };

// Warenkorb, Menü und Suche sind erst nach dem Öffnen nötig: eigener Chunk, im Leerlauf nachgeladen
const ShellOverlays = lazy(() => import("./shell-overlays"));

/** Standardmenü, solange die Kategorien aus dem Admin noch nicht geladen sind (z. B. Vorschau ohne Backend). */
const defaultCategories = [
  "anzuege",
  "sakkos",
  "hosen",
  "hemden",
  "westen",
  "maentel-jacken",
  "strick",
  "schuhe",
  "accessoires",
] as const;
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
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [headerTop, setHeaderTop] = useState<number | null>(null);
  const [scroll, setScroll] = useState({ solid: false, hidden: false });
  const [announcement, setAnnouncement] = useState(0);
  // Wechsel der Ankündigungen: pausierbar (WCAG 2.2.2), pausiert bei Hover, Fokus und im Hintergrund-Tab
  const [announcementPaused, setAnnouncementPaused] = useState(false);
  const [announcementHeld, setAnnouncementHeld] = useState(false);
  const initialAnnouncements = useLocaleLoaderData()?.announcements;
  const settings = useShopSettings();
  const { data: announcements = defaultAnnouncements(settings, locale) } = useQuery({
    ...announcementsQuery(locale),
    ...(initialAnnouncements ? { initialData: initialAnnouncements } : {}),
  });

  const { cartOpen, setCart, menuOpen, setMenu, searchOpen, setSearch } = useShopUI();
  const [overlaysReady, setOverlaysReady] = useState(false);
  useEffect(() => {
    // nach dem Laden im Leerlauf bereitstellen, damit das erste Öffnen sofort reagiert
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setOverlaysReady(true), { timeout: 4000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setOverlaysReady(true), 2500);
    return () => window.clearTimeout(id);
  }, []);
  const count = useCart((s) => s.lines.reduce((a, l) => a + l.quantity, 0));
  const wishes = useWishlist((s) => s.handles.length);
  const label = (handle: string) => t.nav.labels[handle] ?? handle;
  const categories = useNavCategories();
  useEffect(() => {
    useCart.persist.rehydrate();
    useWishlist.persist.rehydrate();
    useRecentlyViewed.persist.rehydrate();
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
    };
    // Warenkorb und Merkliste in mehreren Tabs gleich halten
    const sync = (e: StorageEvent) => {
      if (e.key === "axion-cart") useCart.persist.rehydrate();
      if (e.key === "axion-wishlist") useWishlist.persist.rehydrate();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("storage", sync);
    };
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
    if (announcements.length < 2 || announcementPaused || announcementHeld) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setAnnouncement((n) => (n + 1) % announcements.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [announcements.length, announcementPaused, announcementHeld]);
  useEffect(() => {
    setMenu(false);
    setOccasionOpen(false);
    setCollectionOpen(false);
    setScroll((s) => ({ ...s, hidden: false }));
  }, [pathname, setMenu]);
  return (
    <>
      <a href="#main-content" className="skip-link">
        {t.common.skipToContent}
      </a>
      <section
        className="announcement"
        aria-label={t.common.announcements}
        onMouseEnter={() => setAnnouncementHeld(true)}
        onMouseLeave={() => setAnnouncementHeld(false)}
        onFocus={() => setAnnouncementHeld(true)}
        onBlur={() => setAnnouncementHeld(false)}
      >
        <span key={`${locale}-${announcement}`}>
          {announcements[announcement % announcements.length]}
        </span>
        {announcements.length > 1 && (
          <button
            type="button"
            className="announcement-toggle"
            aria-label={t.common.announcementsPause}
            aria-pressed={announcementPaused}
            onClick={() => setAnnouncementPaused((p) => !p)}
          >
            {announcementPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          </button>
        )}
      </section>
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
            <Link to="/{-$locale}/kollektion/$handle" params={{ locale: lp, handle: "neu" }}>
              {label("neu")}
            </Link>
            {/* Alle Kategorien in einem Menü: bleibt ruhig, auch wenn das Sortiment wächst */}
            <Popover.Root open={collectionOpen} onOpenChange={setCollectionOpen}>
              <Popover.Trigger asChild>
                <Button
                  variant="icon"
                  className="occasion-trigger"
                  aria-expanded={collectionOpen}
                  aria-controls="collection-navigation"
                >
                  {t.nav.collection} <ChevronDown />
                </Button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  id="collection-navigation"
                  className="nav-popover nav-popover-columns"
                  align="start"
                  sideOffset={20}
                >
                  {[...categories, { handle: "alle", title: label("alle") }].map((c) => (
                    <Link
                      key={c.handle}
                      to="/{-$locale}/kollektion/$handle"
                      params={{ locale: lp, handle: c.handle }}
                      onClick={() => setCollectionOpen(false)}
                    >
                      {c.title}
                    </Link>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
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
      <WishlistSync />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      {(overlaysReady || cartOpen || menuOpen || searchOpen) && (
        <Suspense fallback={null}>
          <ShellOverlays categories={categories} wishes={wishes} />
        </Suspense>
      )}
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

const SOCIAL_ICONS: Record<string, typeof Instagram | undefined> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
};

function channelName(channel: string) {
  return channel === "tiktok" ? "TikTok" : channel.charAt(0).toUpperCase() + channel.slice(1);
}

/** Firma und Ort aus der Konfiguration; solange sie noch «[…]» sind, die Marke. */
function footerOwner() {
  const { company, address } = shopConfig.contact;
  const ok = (v: string) => Boolean(v.trim()) && !/\[[^\]]*\]/.test(v);
  if (!ok(company)) return shopConfig.brand;
  // Ort aus der Adresse: letzte Zeile bzw. Teil nach der PLZ («Musterstrasse 1, 8000 Zürich» → Zürich)
  const last = address.split(/[,\n]/).pop()?.trim() ?? "";
  const place = /^\d{4}\s+(.+)$/.exec(last)?.[1];
  return ok(address) && place ? `${company}, ${place}` : company;
}

function Footer() {
  const t = useT();
  const lp = useLocaleParam();
  const categories = useNavCategories();
  const { newsletterWelcomePercent } = useShopSettings();
  const social = socialChannels();
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
            <h2>{t.footer.shop}</h2>
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
            <h2>{t.footer.help}</h2>
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
            <h2>{t.footer.legal}</h2>
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
              <h2>{t.footer.newsletterTitle}</h2>
              <p>
                {t.footer.newsletterText}
                {newsletterWelcomePercent
                  ? ` ${t.footer.welcomeOffer(newsletterWelcomePercent)}`
                  : ""}
              </p>
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
          <span>
            © {new Date().getFullYear()} {footerOwner()}
          </span>
          {social.length > 0 && (
            <ul className="footer-social" aria-label={t.footer.social}>
              {social.map(({ channel, url }) => {
                const Icon = SOCIAL_ICONS[channel];
                const label = t.footer.socialLabels[channel] ?? channel;
                return (
                  <li key={channel}>
                    <a href={url} target="_blank" rel="noopener noreferrer me" aria-label={label}>
                      {Icon ? <Icon size={16} aria-hidden="true" /> : channelName(channel)}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
          <a href="https://flowrenix.com" target="_blank" rel="noopener">
            {t.footer.madeBy}
          </a>
        </div>
      </div>
    </footer>
  );
}
