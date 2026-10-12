// Sprach-Ebene: Deutsch ohne Präfix, Englisch unter /en. Andere Präfixe (z. B. /fr) sind 404.
import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { toLocale } from "@/i18n";
import { announcementsQuery } from "@/lib/commerce/queries";
export const Route = createFileRoute("/{-$locale}")({
  beforeLoad: ({ params }) => {
    if (params.locale !== undefined && params.locale !== "en") throw notFound();
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(announcementsQuery(toLocale(params.locale))),
  component: Outlet,
});
