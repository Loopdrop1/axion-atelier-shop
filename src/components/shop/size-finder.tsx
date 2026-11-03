// Grössenfinder («Welche Grösse passt mir?»): auf der Produktseite als Dialog, auf «Grössenberatung» als Abschnitt.
// Rechnet nur im Browser (findSize in size-finder.ts); die Angaben bleiben in localStorage (size-profile.ts).
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMatch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  findSize,
  finderKind,
  productFinder,
  profileInput,
  type FinderContext,
  type FinderInput,
  type FinderResult,
  type FitWish,
} from "@/lib/commerce/size-finder";
import { useSizeProfile, writeProfile, type SizeProfile } from "@/lib/commerce/size-profile";
import {
  CLOTHING_NUMBERS,
  DEFAULT_LETTERS,
  columnRole,
  sizeWithLetter,
  SHOE_CATEGORIES,
} from "@/lib/commerce/sizes";
import { sizeGuideQuery, sizeLettersQuery, type SizeGuidePageData } from "@/lib/commerce/queries";
import type { Product, SizeGuideTable } from "@/lib/commerce";
import { useLocale, useT } from "@/i18n";

const FITS: FitWish[] = ["slim", "regular", "relaxed"];
type Field = "height" | "chest" | "foot";
const LIMITS: Record<Field, [number, number]> = {
  height: [100, 250],
  chest: [60, 180],
  foot: [15, 40],
};

/** «182», «25,5» → Zahl; leer → undefined; Unsinn → NaN. */
function parse(value: string): number | undefined {
  const v = value.trim().replace(",", ".");
  if (!v) return undefined;
  return /^\d+(\.\d+)?$/.test(v) ? Number(v) : NaN;
}

const show = (n: number | undefined) => (n === undefined ? "" : String(n));

export function SizeFinder({
  context,
  label,
  onChoose,
}: {
  context: FinderContext;
  /** Anzeige einer Grösse, z. B. «50 (L)» */
  label: (size: string) => string;
  /** Produktseite: Grösse übernehmen; ohne: nur die Empfehlung */
  onChoose?: ((size: string) => void) | undefined;
}) {
  const t = useT().sizeFinder;
  const id = useId();
  const shoes = context.kind === "shoes";
  const profile = useSizeProfile();
  const [values, setValues] = useState({ height: "", chest: "", foot: "", usual: "" });
  const [fit, setFit] = useState<FitWish>("regular");
  const [errors, setErrors] = useState<Partial<Record<Field | "form", string>>>({});
  const [result, setResult] = useState<FinderResult | null>(null);
  const filled = useRef(false);

  // Gespeicherte Angaben einmal übernehmen und gleich auswerten
  useEffect(() => {
    if (!profile || filled.current) return;
    filled.current = true;
    setValues({
      height: show(profile.height),
      chest: show(profile.chest),
      foot: show(profile.foot),
      usual: (shoes ? profile.shoeUsual : profile.usual) ?? "",
    });
    if (profile.fit) setFit(profile.fit);
    const input = profileInput(profile, context.kind);
    if (input && (shoes || profile.height)) setResult(findSize(input, context));
  }, [profile, context, shoes]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    const numbers: Partial<Record<Field, number>> = {};
    for (const field of shoes ? (["foot"] as const) : (["height", "chest"] as const)) {
      const n = parse(values[field]);
      const [min, max] = LIMITS[field];
      if (n === undefined) continue;
      if (!Number.isFinite(n) || n < min || n > max) next[field] = t.invalid(min, max);
      else numbers[field] = n;
    }
    if (!shoes && numbers.height === undefined && !next.height)
      next.height = t.invalid(...LIMITS.height);
    const usual = values.usual.trim().slice(0, 10);
    const input: FinderInput = shoes
      ? { foot: numbers.foot, usual }
      : { height: numbers.height, chest: numbers.chest, usual, fit };
    setErrors(next);
    if (Object.keys(next).length) {
      setResult(null);
      return;
    }
    const found = findSize(input, context);
    setResult(found);
    const saved: SizeProfile = shoes
      ? { foot: numbers.foot, shoeUsual: usual || undefined }
      : { height: numbers.height, chest: numbers.chest, usual: usual || undefined, fit };
    writeProfile(saved);
  }

  function forget() {
    writeProfile(null);
    setValues({ height: "", chest: "", foot: "", usual: "" });
    setFit("regular");
    setResult(null);
    setErrors({});
  }

  const field = (name: Field | "usual", text: string, hint: string, decimal = true) => {
    const error = name === "usual" ? undefined : errors[name];
    return (
      <div className="field">
        <label htmlFor={`${id}-${name}`}>{text}</label>
        <input
          id={`${id}-${name}`}
          inputMode={name === "usual" ? "text" : decimal ? "decimal" : "numeric"}
          autoComplete="off"
          maxLength={name === "usual" ? 10 : 5}
          value={values[name]}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-${name}-hint${error ? ` ${id}-${name}-error` : ""}`}
          onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
        />
        <p className="field-hint" id={`${id}-${name}-hint`}>
          {hint}
        </p>
        {error && (
          <p className="form-error" id={`${id}-${name}-error`}>
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <form className="size-finder" onSubmit={submit} noValidate>
      <p className="size-finder-intro">{shoes ? t.introShoes : t.intro}</p>
      {shoes ? (
        <>
          {field("foot", t.foot, t.footHint)}
          {field("usual", t.usualShoes, t.usualShoesHint)}
        </>
      ) : (
        <>
          {field("height", t.height, t.heightHint, false)}
          {field("chest", t.chest, t.chestHint, false)}
          {field("usual", t.usual, t.usualHint)}
          <fieldset className="choice-group">
            <legend>{t.fit}</legend>
            <div className="choice-chips">
              {FITS.map((f) => (
                <label key={f} className={`choice-chip ${fit === f ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name={`${id}-fit`}
                    checked={fit === f}
                    onChange={() => setFit(f)}
                  />
                  {t.fits[f]}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
      <Button type="submit">{t.submit}</Button>
      <div className="size-finder-result" role="status" aria-live="polite">
        {result && <ResultView result={result} shoes={shoes} label={label} onChoose={onChoose} />}
      </div>
      <p className="size-finder-privacy">
        {t.privacy}{" "}
        {profile && Object.keys(profile).length > 0 && (
          <Button type="button" variant="icon" className="text-link" onClick={forget}>
            {t.forget}
          </Button>
        )}
      </p>
    </form>
  );
}

function ResultView({
  result,
  shoes,
  label,
  onChoose,
}: {
  result: FinderResult;
  shoes: boolean;
  label: (size: string) => string;
  onChoose?: ((size: string) => void) | undefined;
}) {
  const t = useT().sizeFinder;
  const notes = result.notes.flatMap((n) =>
    n === "between" && result.status === "ok" && result.shift === 0
      ? [t.between]
      : n === "below-range"
        ? [t.belowRange]
        : n === "above-range"
          ? [t.aboveRange]
          : n === "proportions"
            ? [t.proportions]
            : [],
  );
  if (result.status === "none")
    return (
      <>
        <p className="size-finder-answer is-missing">
          {result.reason === "not-offered" ? t.notOffered : shoes ? t.missingShoes : t.missing}
        </p>
        {notes.map((n) => (
          <p key={n}>{n}</p>
        ))}
      </>
    );
  const name = label(result.size);
  return (
    <>
      <p className="size-finder-answer">{t.result(name)}</p>
      <p>
        {t.basis[result.basis]}
        {result.shift < 0 && ` ${t.shiftDown}`}
        {result.shift > 0 && ` ${t.shiftUp}`}
      </p>
      {notes.map((n) => (
        <p key={n}>{n}</p>
      ))}
      {result.soldOut ? (
        <p className="size-finder-soldout">{t.soldOut}</p>
      ) : (
        onChoose && (
          <Button type="button" variant="tailored" onClick={() => onChoose(result.size)}>
            {t.choose(name)}
          </Button>
        )
      )}
    </>
  );
}

/** Art einer Tabelle für den Finder auf «Grössenberatung»; null = Tabelle ohne Finder (z. B. Gürtel). */
function tableKind(table: SizeGuideTable): FinderContext["kind"] | null {
  const roles = table.columns.map(columnRole);
  if (table.categories.some((c) => SHOE_CATEGORIES.includes(c)) || roles.includes("foot"))
    return "shoes";
  if (table.categories.includes("accessoires")) return null;
  return roles.includes("chest") || roles.includes("height") ? "clothing" : null;
}

/** Abschnitt «Welche Grösse passt mir?» auf der Seite «Grössenberatung»: Stück wählen, dann der Finder. */
export function SizeFinderSection() {
  const t = useT().sizeFinder;
  const locale = useLocale();
  const id = useId();
  // Startwerte aus dem Loader der Seite, damit Server und Browser dasselbe rendern
  const initial = useMatch({
    from: "/{-$locale}/groessenberatung",
    shouldThrow: false,
  })?.loaderData as SizeGuidePageData | undefined;
  const { data: tables = [] } = useQuery({
    ...sizeGuideQuery(locale),
    ...(initial?.tables ? { initialData: initial.tables } : {}),
  });
  const { data: letters = DEFAULT_LETTERS } = useQuery({
    ...sizeLettersQuery(),
    ...(initial?.letters ? { initialData: initial.letters } : {}),
  });
  const usable = tables.flatMap((table) => {
    const kind = tableKind(table);
    return kind ? [{ table, kind }] : [];
  });
  const [chosen, setChosen] = useState("");
  const current = usable.find((u) => u.table.id === chosen) ?? usable[0];
  // Ohne Tabelle: Norm der Konfektionsgrössen (Grösse ≈ halber Brustumfang)
  const context: FinderContext = current
    ? {
        kind: current.kind,
        sizes: current.table.rows.map((r) => ({ title: r[0] ?? "", available: true })),
        table: current.table,
        letters,
        norm: !current.table.categories.includes("hemden"),
      }
    : {
        kind: "clothing",
        sizes: CLOTHING_NUMBERS.map((title) => ({ title, available: true })),
        letters,
      };
  const label = (size: string) => {
    const row = current?.table.rows.findIndex((r) => r[0] === size) ?? -1;
    const letter = current
      ? row >= 0
        ? current.table.international?.[row]
        : undefined
      : letters[size];
    return sizeWithLetter(size, letter);
  };
  return (
    <section className="size-finder-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t.sectionTitle}</h2>
      {usable.length > 1 && (
        <div className="field">
          <label htmlFor={`${id}-piece`}>{t.piece}</label>
          <select
            id={`${id}-piece`}
            className="form-select"
            value={current?.table.id ?? ""}
            onChange={(e) => setChosen(e.target.value)}
          >
            {usable.map((u) => (
              <option key={u.table.id} value={u.table.id}>
                {u.table.title || u.table.columns[0]}
              </option>
            ))}
          </select>
        </div>
      )}
      {/* Neu aufbauen beim Wechsel des Stücks: Ergebnis gehört zur gewählten Tabelle */}
      <SizeFinder key={current?.table.id ?? "norm"} context={context} label={label} />
    </section>
  );
}

/**
 * Grösse, die der Finder mit den gespeicherten Angaben für dieses Stück empfiehlt («Deine Grösse»), sonst undefined.
 * Lädt Tabellen und Zuordnung nur, wenn im Browser Angaben gespeichert sind.
 */
export function useSuggestedSize(product: Product): string | undefined {
  const locale = useLocale();
  const profile = useSizeProfile();
  const kind = profile ? finderKind(product) : null;
  const input = profile && kind ? profileInput(profile, kind) : null;
  const usable = Boolean(input && (kind === "shoes" || profile?.height));
  const tables = useQuery({ ...sizeGuideQuery(locale), enabled: usable });
  const letters = useQuery({ ...sizeLettersQuery(), enabled: usable });
  if (!usable || !input || !tables.data || !letters.data) return undefined;
  const context = productFinder(product, tables.data, letters.data);
  const result = context ? findSize(input, context) : null;
  return result?.status === "ok" ? result.size : undefined;
}

/** Finder für ein Stück (im Dialog der Produktseite); lädt Tabelle und Zuordnung beim Öffnen. */
export function ProductSizeFinder({
  product,
  onChoose,
}: {
  product: Product;
  onChoose: (size: string) => void;
}) {
  const locale = useLocale();
  const tables = useQuery(sizeGuideQuery(locale));
  const letters = useQuery(sizeLettersQuery());
  if (tables.isLoading || letters.isLoading) return null;
  const context = productFinder(product, tables.data ?? [], letters.data ?? DEFAULT_LETTERS);
  if (!context) return null;
  const label = (size: string) =>
    sizeWithLetter(size, product.variants.find((v) => v.title === size)?.letter);
  return <SizeFinder context={context} label={label} onChoose={onChoose} />;
}
