// /api/health: Erreichbarkeit und Katalog für die Überwachung (docs/BETRIEB.md). Antwort ohne Geheimnisse,
// nie zwischengespeichert, für Suchmaschinen gesperrt (robots.txt).
import { createFileRoute } from "@tanstack/react-router";
import { listCollections } from "@/lib/commerce";
import { checkHealth } from "@/lib/health";

async function respond(head: boolean): Promise<Response> {
  const result = await checkHealth(() => listCollections("de"));
  return new Response(head ? null : JSON.stringify(result), {
    status: result.ok ? 200 : 503,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () => respond(false),
      HEAD: () => respond(true),
    },
  },
});
