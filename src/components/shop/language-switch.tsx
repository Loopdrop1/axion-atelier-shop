// Sprachwechsel: gleiche Seite in der anderen Sprache (Suchparameter und Anker bleiben).
import { useRouter, useRouterState } from "@tanstack/react-router";
import { htmlLang, switchLocalePath, useLocale, useT } from "@/i18n";
export function LanguageSwitch({
  className = "",
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const href = useRouterState({ select: (s) => s.location.href });
  const target = locale === "en" ? "de" : "en";
  const to = switchLocalePath(href, target);
  const code = target === "en" ? "EN" : "DE";
  return (
    <a
      className={`language-switch ${className}`}
      href={to}
      hrefLang={htmlLang(target)}
      lang={htmlLang(target)}
      // Der zugängliche Name beginnt mit dem sichtbaren Text (WCAG 2.5.3 Label in Name)
      aria-label={`${code}: ${t.language.switchLabel}`}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        onNavigate?.();
        router.history.push(to);
      }}
    >
      {code}
    </a>
  );
}
