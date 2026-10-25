// Teilen-Knopf ohne Drittskripte: Web Share API, sonst Link in die Zwischenablage kopieren.
// Das Ergebnis meldet ein sichtbarer Statustext (role="status"), damit es auch Screenreader hören.
import { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { useT } from "@/i18n";

export function ShareButton({ title, label }: { title: string; label?: string }) {
  const t = useT();
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function say(message: string) {
    setStatus(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(""), 4000);
  }

  async function share() {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      say(t.product.shareCopied);
    } catch (error) {
      // Abbruch durch die Person ist kein Fehler
      if (error instanceof DOMException && error.name === "AbortError") return;
      say(t.product.shareFailed);
    }
  }

  return (
    <div className="share-row">
      <button
        type="button"
        className="share-button"
        aria-label={label ?? t.product.shareLabel(title)}
        onClick={() => void share()}
      >
        <Share2 size={16} aria-hidden="true" />
        {t.product.share}
      </button>
      <p className="share-status" role="status">
        {status}
      </p>
    </div>
  );
}
