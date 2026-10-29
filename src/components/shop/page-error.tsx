import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { reportClientError } from "@/lib/client-errors";
import { reportLovableError } from "@/lib/lovable-error-reporting";

/** Fehlerseite mit Meldung, «Erneut versuchen» und «Zur Startseite».
 *  `shell`: innerhalb der Shop-Shell (Kopf, Navigation und Fusszeile bleiben), dort liefert die Shell schon `<main>`. */
export function PageError({
  error,
  reset,
  shell = false,
}: Pick<ErrorComponentProps, "error" | "reset"> & { shell?: boolean }) {
  console.error(error);
  const router = useRouter();
  const t = useT();
  useEffect(() => {
    reportLovableError(error, {
      boundary: shell ? "tanstack_route_error_component" : "tanstack_root_error_component",
    });
    reportClientError(error);
  }, [error, shell]);

  // Sprache aus dem Pfad, damit «Zur Startseite» nicht von Englisch auf Deutsch springt
  const home =
    typeof window !== "undefined" && /^\/en(\/|$)/.test(window.location.pathname) ? "/en" : "/";
  const Tag = shell ? "div" : "main";
  return (
    <Tag className="error-page">
      <p className="eyebrow">Axion</p>
      <h1>{t.errorPage.title}</h1>
      <p>{t.errorPage.text}</p>
      <div className="error-page-actions">
        <Button
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          {t.common.retry}
        </Button>
        <Button variant="tailored" asChild>
          <a href={home}>{t.common.toHome}</a>
        </Button>
      </div>
    </Tag>
  );
}

/** Standard für alle Seiten (router.tsx): Fehler einer Seite ersetzen nur den Inhalt, nicht die ganze Shell. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  return <PageError error={error} reset={reset} shell />;
}
