// Sprach-Ebene: Deutsch ohne Präfix, Englisch unter /en. Andere Präfixe (z. B. /fr) sind 404.
import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { toLocale } from "@/i18n";
import { announcementsQuery, navQuery, settingsQuery } from "@/lib/commerce/queries";
export const Route = createFileRoute("/{-$locale}")({
  beforeLoad: ({ params }) => {
    if (params.locale !== undefined && params.locale !== "en") throw notFound();
  },
  // Gibt die Daten für Kopf, Menü und Versandtexte zurück: So hat der Browser beim Hydrieren dieselben Werte wie der
  // Server (die Abfragen selbst werden nicht mitgeschickt). Ohne Backend oder bei einem Fehler bleiben die
  // Standardwerte; die Seite (Rechtstexte, Kontakt) bleibt erreichbar.
  loader: async ({ context, params }) => {
    const locale = toLocale(params.locale);
    const [announcements, nav, settings] = await Promise.all([
      context.queryClient.ensureQueryData(announcementsQuery(locale)).catch(() => undefined),
      context.queryClient.ensureQueryData(navQuery(locale)).catch(() => undefined),
      context.queryClient.ensureQueryData(settingsQuery()).catch(() => undefined),
    ]);
    return { announcements, nav, settings };
  },
  component: Outlet,
});
