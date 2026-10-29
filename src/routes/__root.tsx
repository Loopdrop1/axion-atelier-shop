import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
// Nur die lateinischen Teilsätze (Deutsch, Englisch) vorladen; Kyrillisch usw. laden nur bei Bedarf über unicode-range
import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import jostLatin from "@fontsource-variable/jost/files/jost-latin-wght-normal.woff2?url";
import { ShopShell } from "@/components/shop/shell";
import { MissingPage } from "@/components/shop/missing-page";
import { PageError } from "@/components/shop/page-error";
import { shopConfig } from "@/config/shop";
import { htmlLang, useLocale, useT } from "@/i18n";
import { marketingHead } from "@/lib/marketing";

function NotFoundComponent() {
  const t = useT();
  // Pfade ohne eigene Seite (z. B. /gibt-es-nicht) haben keine Seiten-Metadaten: Titel und noindex setzen
  return (
    <>
      <title>{`${t.notFound.metaTitle} · Axion`}</title>
      <meta name="robots" content="noindex, nofollow" />
      <MissingPage />
    </>
  );
}

/** Letzte Stufe: nur wenn die Shell selbst ausfällt (Seitenfehler fängt RouteError in router.tsx). */
function ErrorComponent({ error, reset }: ErrorComponentProps) {
  return <PageError error={error} reset={reset} />;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: ({ matches }) => {
    const marketing = marketingHead({
      admin: matches.some((m) => /^\/admin(\/|$)/.test(m.routeId)),
      dev: import.meta.env.DEV,
    });
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { property: "og:site_name", content: "Axion" },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "theme-color", content: "#1E3A2F" },
        ...(!shopConfig.launched ? [{ name: "robots", content: "noindex, nofollow" }] : []),
        ...marketing.meta,
      ],
      scripts: marketing.scripts,
      links: [
        {
          rel: "preload",
          as: "font",
          type: "font/woff2",
          href: jostLatin,
          crossOrigin: "anonymous",
        },
        {
          rel: "preload",
          as: "font",
          type: "font/woff2",
          href: interLatin,
          crossOrigin: "anonymous",
        },
        {
          rel: "stylesheet",
          href: appCss,
        },
        { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
        { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        { rel: "manifest", href: "/site.webmanifest" },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const locale = useLocale();
  return (
    <html lang={htmlLang(locale)} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const t = useT();
  // Das Admin hat ein eigenes Layout (src/routes/admin.tsx), der Shop den ShopShell mit Kopf- und Fusszeile.
  const admin = useRouterState({ select: (s) => /^\/admin(\/|$)/.test(s.location.pathname) });
  // Merker für Browser-Tests (e2e/): Seite ist hydriert und reagiert auf Eingaben.
  useEffect(() => {
    document.documentElement.dataset["hydrated"] = "true";
  }, []);

  // Ladebalken, solange ein Seitenwechsel auf Daten wartet (erscheint erst nach kurzer Verzögerung, siehe CSS)
  const loading = useRouterState({ select: (s) => s.status === "pending" });

  return (
    <QueryClientProvider client={queryClient}>
      {loading && (
        <div className="route-progress" role="progressbar" aria-label={t.common.loading} />
      )}
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      {admin ? (
        <Outlet />
      ) : (
        <ShopShell>
          <Outlet />
        </ShopShell>
      )}
    </QueryClientProvider>
  );
}
