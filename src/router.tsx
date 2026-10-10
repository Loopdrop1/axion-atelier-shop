import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    stringifySearch: (search) => {
      const pairs = Object.entries(search).filter(([, value]) => value !== undefined && value !== null && value !== "");
      return pairs.length ? "?" + pairs.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value)).replace(/%2C/gi, ",")}`).join("&") : "";
    },
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
