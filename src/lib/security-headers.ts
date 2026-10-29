// Sicherheits-Header für jede Antwort des Shops (Seiten, Server-Routen, Server-Funktionen).
// Kein vollständiges script-src-CSP: Stripe, Plausible und die Inline-Skripte des Shells würden brechen.
// frame-ancestors verhindert Clickjacking (Admin-Aktionen, Konto löschen); lovable.dev bleibt erlaubt,
// weil der Lovable-Editor die Vorschau im iframe zeigt. HSTS setzt der Host (TLS-Domain).
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy": "frame-ancestors 'self' https://lovable.dev https://*.lovable.dev",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

/** Setzt die Header ohne bestehende zu überschreiben; bei unveränderlichen Headern (Response.redirect) als Kopie. */
export function withSecurityHeaders(response: Response): Response {
  const missing = Object.entries(SECURITY_HEADERS).filter(([name]) => !response.headers.has(name));
  if (missing.length === 0) return response;
  try {
    for (const [name, value] of missing) response.headers.set(name, value);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    for (const [name, value] of missing) headers.set(name, value);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
