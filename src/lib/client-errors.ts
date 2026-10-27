// Technische Fehlerberichte aus dem Browser (Edge Function «client-error», Anzeige im Admin unter /admin/fehler).
// Klein halten: Das Modul gehört zum ersten Laden der Shop-Hülle. Die Funktion `callFunction` (und mit ihr der
// Supabase-Client) wird erst beim ersten Bericht nachgeladen. Keine Personendaten: nur Meldung, Pfad ohne
// Query-String, Stack, Version; die Funktion entfernt zusätzlich Adressen und E-Mails aus dem Text.
import { backendConfigured } from "@/lib/backend";

/** Höchstens so viele Berichte pro Seitenaufruf (ein Fehler in einer Schleife soll die Bremse nicht fluten). */
export const MAX_REPORTS_PER_PAGE_VIEW = 5;

export interface ErrorReport {
  message: string;
  stack: string;
  path: string;
  release: string;
}

/** Meldungen, die kein Fehler der Website sind (Browser, Erweiterungen, fremde Skripte). */
const NOISE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /Non-Error promise rejection captured/i,
  /^(Load failed|Failed to fetch|NetworkError when attempting to fetch resource\.?)$/i,
  /chrome-extension:|moz-extension:|safari-extension:|safari-web-extension:/i,
];

export function isNoise(message: string, stack = ""): boolean {
  return NOISE.some((re) => re.test(message) || re.test(stack));
}

/** Drosselung pro Seitenaufruf: höchstens `max` Berichte, jeder gleiche Fehler nur einmal. */
export function createThrottle(max = MAX_REPORTS_PER_PAGE_VIEW) {
  const seen = new Set<string>();
  return {
    allow(message: string, stack = ""): boolean {
      if (seen.size >= max) return false;
      const key = `${message}\n${stack.split("\n").slice(0, 2).join("\n")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
  };
}

function describe(value: unknown): { message: string; stack: string } {
  if (value instanceof Error)
    return { message: `${value.name}: ${value.message}`, stack: value.stack ?? "" };
  if (typeof value === "string") return { message: value, stack: "" };
  try {
    return { message: JSON.stringify(value) ?? String(value), stack: "" };
  } catch {
    return { message: String(value), stack: "" };
  }
}

/** Version der Website: VITE_APP_RELEASE, sonst der Name der Haupt-Skriptdatei (enthält den Build-Hash). */
export function releaseId(): string {
  const env = (import.meta.env["VITE_APP_RELEASE"] as string | undefined) ?? "";
  if (env) return env.slice(0, 64);
  if (typeof document === "undefined") return "";
  const src = document.querySelector<HTMLScriptElement>(
    'script[type="module"][src*="/assets/"]',
  )?.src;
  return /\/assets\/([\w.-]+?)\.js/.exec(src ?? "")?.[1]?.slice(0, 64) ?? "";
}

type Send = (report: ErrorReport) => void | Promise<void>;

async function sendToBackend(report: ErrorReport): Promise<void> {
  const { callFunction } = await import("@/integrations/supabase/functions");
  await callFunction("client-error", report);
}

/** Zum Testen austauschbar. */
export function createReporter(options: {
  enabled: boolean;
  send?: Send;
  throttle?: ReturnType<typeof createThrottle>;
  location?: () => string;
  release?: () => string;
}) {
  const throttle = options.throttle ?? createThrottle();
  const send = options.send ?? sendToBackend;
  const location = options.location ?? (() => window.location.pathname);
  const release = options.release ?? releaseId;
  return {
    report(error: unknown, context: { filename?: string } = {}): boolean {
      if (!options.enabled) return false;
      const { message, stack } = describe(error);
      const text = message.trim();
      if (!text || isNoise(text, `${stack}\n${context.filename ?? ""}`)) return false;
      if (!throttle.allow(text, stack)) return false;
      const report: ErrorReport = {
        message: text.slice(0, 500),
        stack: stack.slice(0, 2000),
        // nur der Pfad: nie Query-String oder Fragment (können Tokens oder Suchbegriffe enthalten)
        path: location().split(/[?#]/)[0] || "/",
        release: release(),
      };
      // Der Bericht darf nie selbst einen Fehler auslösen
      try {
        void Promise.resolve(send(report)).catch(() => undefined);
      } catch {
        /* ignorieren */
      }
      return true;
    },
  };
}

const enabled = typeof window !== "undefined" && backendConfigured && !import.meta.env.DEV;
const reporter = createReporter({ enabled });

/** Für Fehlergrenzen (z. B. die Fehlerseite in __root.tsx). Ohne Backend und in der Entwicklung ohne Wirkung. */
export function reportClientError(error: unknown): void {
  reporter.report(error);
}

/** Meldet Fehler des Fensters und nicht abgefangene Promises, installiert im Leerlauf nach dem Laden. */
export function installClientErrorReporting(): () => void {
  if (!enabled) return () => undefined;
  const onError = (e: ErrorEvent) =>
    reporter.report(e.error ?? e.message, { filename: e.filename });
  const onRejection = (e: PromiseRejectionEvent) => reporter.report(e.reason);
  const attach = () => {
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
  };
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  let cancel: () => void;
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(attach, { timeout: 5000 });
    cancel = () => w.cancelIdleCallback?.(id);
  } else {
    const id = window.setTimeout(attach, 3000);
    cancel = () => window.clearTimeout(id);
  }
  return () => {
    cancel();
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
