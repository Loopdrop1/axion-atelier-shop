// Rahmen des Shops (Kopf- und Fusszeile um jede öffentliche Seite, siehe __root.tsx): «Made by Flowrenix.com»
// steht auf jeder Seite in der Fusszeile; Menü und Fusszeile zeigen nur die aktiven Kategorien aus dem Admin
// (zum Start fünf, supabase/demo/sortiment-start.sql), nichts fest auf das Muster-Sortiment mit neun.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DEFAULT_SETTINGS } from "@/lib/commerce/source";

class NoObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", NoObserver);
vi.stubGlobal("ResizeObserver", NoObserver);

const route = vi.hoisted(() => ({ pathname: "/", locale: "de" as "de" | "en" }));
const START = [
  { handle: "anzuege", title: "Anzüge" },
  { handle: "hosen", title: "Hosen" },
  { handle: "t-shirts", title: "T-Shirts" },
  { handle: "westen", title: "Westen" },
  { handle: "schuhe", title: "Schuhe" },
];

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    className,
    params,
  }: {
    children: ReactNode;
    className?: string;
    params?: { handle?: string };
  }) => (
    <a href={params?.handle ? `/kollektion/${params.handle}` : "/"} className={className}>
      {children}
    </a>
  ),
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname: route.pathname }, status: "idle" }),
}));
vi.mock("@/i18n", async (orig) => {
  const actual = (await orig()) as typeof import("@/i18n");
  return {
    ...actual,
    useLocale: () => route.locale,
    useT: () => actual.messages[route.locale],
    useLocaleParam: () => (route.locale === "en" ? "en" : undefined),
  };
});
vi.mock("@/lib/commerce/use-settings", () => ({ useShopSettings: () => DEFAULT_SETTINGS }));
vi.mock("@/lib/commerce/locale-data", () => ({
  useLocaleLoaderData: () => ({
    nav: START,
    announcements: ["Versand innert 2 bis 5 Arbeitstagen"],
  }),
}));
vi.mock("@/lib/client-errors", () => ({
  installClientErrorReporting: () => () => undefined,
  reportClientError: () => undefined,
}));
vi.mock("./shell-overlays", () => ({ default: () => null }));
vi.mock("./wishlist-sync", () => ({ WishlistSync: () => null }));
vi.mock("./newsletter-form", () => ({ NewsletterForm: () => null }));
vi.mock("./language-switch", () => ({ LanguageSwitch: () => null }));

import { ShopShell } from "./shell";

function renderAt(pathname: string, locale: "de" | "en" = "de") {
  route.pathname = pathname;
  route.locale = locale;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ShopShell>
        <p>Seiteninhalt</p>
      </ShopShell>
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("Shop-Rahmen: Fusszeile", () => {
  it.each([
    ["/", "de"],
    ["/kollektion/anzuege", "de"],
    ["/produkt/anzug-limmat-marine", "de"],
    ["/warenkorb", "de"],
    ["/impressum", "de"],
    ["/en", "en"],
    ["/en/produkt/anzug-limmat-marine", "en"],
  ] as const)("%s: «Made by Flowrenix.com» mit Link auf flowrenix.com", (pathname, locale) => {
    renderAt(pathname, locale);
    expect(screen.getByText("Seiteninhalt")).toBeInTheDocument();
    const footer = screen.getByRole("contentinfo");
    const link = within(footer).getByRole("link", { name: "Made by Flowrenix.com" });
    expect(link).toHaveAttribute("href", "https://flowrenix.com");
  });

  it("listet nur die aktiven Kategorien (Sortiment zum Start), dazu Neu und Sale", () => {
    renderAt("/");
    const footer = screen.getByRole("contentinfo");
    const collections = within(footer)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"))
      .filter((href) => href?.startsWith("/kollektion/"));
    expect(collections).toEqual([
      "/kollektion/neu",
      ...START.map((c) => `/kollektion/${c.handle}`),
      "/kollektion/sale",
    ]);
    expect(within(footer).queryByText("Sakkos")).toBeNull();
    expect(within(footer).queryByText("Accessoires")).toBeNull();
  });
});
