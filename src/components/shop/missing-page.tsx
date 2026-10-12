import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useLocaleParam, useT } from "@/i18n";
export function MissingPage() {
  const t = useT();
  const locale = useLocaleParam();
  return (
    <div className="container page-body">
      <p className="eyebrow">404</p>
      <h1 className="page-title">{t.notFound.title}</h1>
      <p className="page-intro">{t.notFound.text}</p>
      <div className="empty-links justify-start">
        <Button asChild>
          <Link to="/{-$locale}/kollektion/$handle" params={{ locale, handle: "alle" }}>
            {t.common.discoverCollection}
          </Link>
        </Button>
        <Button variant="tailored" asChild>
          <Link to="/{-$locale}" params={{ locale }}>
            {t.common.toHome}
          </Link>
        </Button>
      </div>
    </div>
  );
}
