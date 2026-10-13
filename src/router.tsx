import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    stringifySearch: (search) => {
      const pairs = Object.entries(search).filter(
        ([, value]) => value !== undefined && value !== null && value !== "",
      );
      return pairs.length
        ? "?" +
            pairs
              .map(
                ([key, value]) =>
                  `${encodeURIComponent(key)}=${encodeURIComponent(String(value)).replace(/%2C/gi, ",")}`,
              )
              .join("&")
        : "";
    },
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Weicher Wechsel zwischen den Seiten (wo der Browser es kann; bei «weniger Bewegung» ohne Animation).
    // Nur bei neuer Seite: Suche, Filter und Sortierung ändern nur die Adresse und blenden nicht über.
    defaultViewTransition: { types: ({ pathChanged }) => (pathChanged ? ["seite"] : false) },
  });

  return router;
};
