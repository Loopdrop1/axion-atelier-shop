// Anmeldung fürs Admin (gleiche Konten wie im Shop; Admin-Rechte vergibt ein Admin unter «Zugänge»).
import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AdminBare } from "@/components/admin/shell";
import { TextField } from "@/components/admin/ui";
import { safeNext } from "@/components/account/form";
import { backendConfigured } from "@/lib/backend";
import { isAdmin } from "@/lib/admin/api";
import { signIn, signOut, type AuthProblem } from "@/lib/account/api";
import { useSession } from "@/lib/account/session";

export const Route = createFileRoute("/admin/anmelden")({
  validateSearch: (s: Record<string, unknown>): { weiter?: string | undefined } => ({
    weiter: typeof s["weiter"] === "string" ? s["weiter"] : undefined,
  }),
  component: AdminSignIn,
});

const PROBLEMS: Partial<Record<AuthProblem, string>> = {
  invalid_credentials: "E-Mail-Adresse oder Passwort stimmen nicht.",
  email_not_confirmed: "Bitte zuerst die E-Mail-Adresse bestätigen (Link in der E-Mail).",
  rate_limited: "Zu viele Versuche. Bitte ein paar Minuten warten.",
  network: "Keine Verbindung. Bitte Internet prüfen.",
  not_configured: "Das Backend ist noch nicht verbunden.",
};

function AdminSignIn() {
  const navigate = useNavigate();
  const { weiter } = Route.useSearch();
  const { ready, user } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const target = safeNext(weiter, "/admin");
  const role = useQuery({
    queryKey: ["admin", "is-admin", user?.id],
    queryFn: () => isAdmin(user!.id),
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (user && role.data)
      void navigate({ href: target.startsWith("/admin") ? target : "/admin", replace: true });
  }, [user, role.data, navigate, target]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (!result.ok) setError(PROBLEMS[result.problem] ?? "Die Anmeldung hat nicht geklappt.");
  }

  if (user && role.data === false)
    return (
      <AdminBare>
        <h1>Kein Zugriff</h1>
        <p className="admin-muted">
          Du bist als {user.email} angemeldet, hast aber keine Admin-Rechte.
        </p>
        <Button variant="admin" onClick={() => void signOut()}>
          Mit anderem Konto anmelden
        </Button>
      </AdminBare>
    );

  return (
    <AdminBare>
      <h1>Anmelden</h1>
      {!backendConfigured ? (
        <p className="admin-muted">Das Admin funktioniert, sobald Supabase eingerichtet ist.</p>
      ) : !ready || (user && role.isLoading) ? (
        <p className="admin-muted">Wird geladen …</p>
      ) : (
        <form className="admin-form" onSubmit={submit} noValidate>
          <TextField
            label="E-Mail-Adresse"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Passwort"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="admin" disabled={busy || !email.trim() || !password}>
            {busy ? "Anmeldung läuft …" : "Anmelden"}
          </Button>
          <p className="admin-hint">
            Passwort vergessen? Im Shop unter <a href="/konto/passwort-vergessen">Kundenkonto</a>{" "}
            einen Link anfordern.
          </p>
        </form>
      )}
    </AdminBare>
  );
}
