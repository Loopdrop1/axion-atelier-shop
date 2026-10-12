import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
const router = () => createRouter({ routeTree, context: { queryClient: new QueryClient() } });
const leaf = (path: string) => router().matchRoutes(path).at(-1)?.routeId;

describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    expect(leaf("/")).not.toBe(rootRouteId);
  });

  it("serves every shop page in German (no prefix) and English (/en)", () => {
    const pages: [string, string][] = [
      ["/", "/{-$locale}/"],
      ["/kollektion/anzuege", "/{-$locale}/kollektion/$handle"],
      ["/produkt/anzug-limmat-marine", "/{-$locale}/produkt/$handle"],
      ["/warenkorb", "/{-$locale}/warenkorb"],
      ["/geschenkgutschein", "/{-$locale}/geschenkgutschein"],
      ["/bestellung/6f1c2a7e-1d2b-4c3d-9e8f-0a1b2c3d4e5f", "/{-$locale}/bestellung/$token"],
      ["/konto", "/{-$locale}/konto/"],
      ["/konto/anmelden", "/{-$locale}/konto/anmelden"],
      ["/konto/registrieren", "/{-$locale}/konto/registrieren"],
      ["/konto/bestaetigen", "/{-$locale}/konto/bestaetigen"],
      ["/konto/passwort-vergessen", "/{-$locale}/konto/passwort-vergessen"],
      ["/konto/passwort-neu", "/{-$locale}/konto/passwort-neu"],
      ["/konto/bestellungen/1042", "/{-$locale}/konto/bestellungen/$number"],
      ["/konto/daten", "/{-$locale}/konto/daten"],
      ["/newsletter/bestaetigen", "/{-$locale}/newsletter/bestaetigen"],
      ["/newsletter/abmelden", "/{-$locale}/newsletter/abmelden"],
      ["/datenschutz", "/{-$locale}/datenschutz"],
    ];
    for (const [path, routeId] of pages) {
      expect(leaf(path), path).toBe(routeId);
      expect(leaf(`/en${path === "/" ? "" : path}`), `/en${path}`).toBe(routeId);
    }
  });

  it("captures the language prefix as a route parameter", () => {
    const match = router()
      .matchRoutes("/en/konto/daten")
      .find((m) => m.routeId === "/{-$locale}");
    expect(match?.params).toMatchObject({ locale: "en" });
  });
});
