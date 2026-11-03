// Grössenfinder («Welche Grösse passt mir?»): reine Funktion, getestet in size-finder.test.ts.
// Reihenfolge der Quellen:
//   Kleidung: (a) Brustumfang mit der Spalte «Brust» der Grössentabelle, (b) Brustumfang nach der Norm der deutschen
//   Herren-Konfektion (Grösse ≈ halber Brustumfang), (c) die übliche Grösse (wie sie im Shop heisst; Buchstabe ↔ Zahl
//   nur mit gespeicherter Zuordnung), (d) nur die Körpergrösse mit der Spalte «Körpergrösse» (grobe Schätzung).
//   Schuhe: Fusslänge mit der Spalte «Fusslänge», sonst die übliche EU-Grösse.
// Empfohlen wird immer eine Grösse, die das Stück tatsächlich führt (ausverkauft wird gemeldet, nicht ersetzt).
// Der Passformwunsch verschiebt nur in Grenzfällen (zwischen zwei Grössen oder am Rand eines Bereichs) eine Grösse.
import { isOneSizeTitle, oneSizeVariant } from "./one-size";
import {
  cleanLetter,
  columnRole,
  isNumberSize,
  measureRows,
  NO_LETTER_CATEGORIES,
  numberForLetter,
  SHOE_CATEGORIES,
  type MeasureRow,
  type SizeLetters,
} from "./sizes";
import type { SizeGuideTable } from "./mapping";
import type { Product } from "./types";
import type { SizeProfile } from "./size-profile";

export type FitWish = "slim" | "regular" | "relaxed";
export type FinderKind = "clothing" | "shoes";

export interface FinderInput {
  /** Körpergrösse in cm */
  height?: number | undefined;
  /** Brustumfang in cm (Kleidung) */
  chest?: number | undefined;
  /** Fusslänge in cm (Schuhe) */
  foot?: number | undefined;
  /** «Diese Grösse trage ich sonst»: Zahl oder Buchstabe */
  usual?: string | undefined;
  fit?: FitWish | undefined;
}

export interface FinderSize {
  title: string;
  available: boolean;
}

export interface FinderContext {
  kind: FinderKind;
  /** Grössen des Stücks in Reihenfolge (aktive Varianten) */
  sizes: FinderSize[];
  /** Grössentabelle der Kategorie (erste Spalte = Grösse), falls vorhanden */
  table?: { columns: string[]; rows: string[][] } | undefined;
  letters: SizeLetters;
  /** Norm «Grösse ≈ halber Brustumfang» erlaubt (nicht für Hemden mit Kragenweite) */
  norm?: boolean | undefined;
}

export type FinderBasis = "chest-table" | "chest-norm" | "usual" | "height-table" | "foot-table";
export type FinderNote =
  /** zwischen zwei Grössen, der Passformwunsch hat entschieden */
  | "between"
  /** kleiner als die kleinste bzw. grösser als die grösste Grösse dieses Stücks */
  | "below-range"
  | "above-range"
  /** sehr grosse oder kleine Körpergrösse: Ärmel und Beinlänge können abweichen */
  | "proportions"
  /** nur nach Körpergrösse geschätzt */
  | "estimate";

export type FinderResult =
  | {
      status: "ok";
      size: string;
      soldOut: boolean;
      basis: FinderBasis;
      /** −1 / +1, wenn der Passformwunsch die Grösse verschoben hat */
      shift: -1 | 0 | 1;
      notes: FinderNote[];
    }
  | {
      status: "none";
      reason: "missing-input" | "not-offered" | "no-data";
      notes: FinderNote[];
    };

/** Körpergrösse, ab der Ärmel und Beinlänge oft nicht mehr zur Konfektion passen. */
export const HEIGHT_MIN = 165;
export const HEIGHT_MAX = 195;

const valid = (n: number | undefined, min: number, max: number): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;

/** Grösse aus der Tabelle → Grösse des Stücks (direkt, oder über die Zuordnung Zahl ↔ Buchstabe). */
function offered(size: string, ctx: FinderContext): FinderSize | undefined {
  const s = size.trim();
  const direct = ctx.sizes.find((v) => v.title.trim().toUpperCase() === s.toUpperCase());
  if (direct) return direct;
  if (ctx.kind === "shoes") return undefined;
  const letter = isNumberSize(s) ? ctx.letters[s] : undefined;
  const number = isNumberSize(s) ? undefined : numberForLetter(s, ctx.letters);
  return ctx.sizes.find(
    (v) =>
      (letter && v.title.trim().toUpperCase() === letter) || (number && v.title.trim() === number),
  );
}

interface Step {
  index: number;
  shift: -1 | 0 | 1;
  notes: FinderNote[];
}

/**
 * Position eines Masses in aufsteigenden Bereichen. Innerhalb eines Bereichs gilt er; am oberen bzw. unteren
 * Viertel verschiebt «bequem» bzw. «eng anliegend» um eine Grösse. Zwischen zwei Bereichen gilt der nähere; im
 * mittleren Teil der Lücke entscheidet der Passformwunsch (normal: ab der Mitte die grössere).
 */
export function placeInRanges(value: number, ranges: [number, number][], fit: FitWish): Step {
  const last = ranges.length - 1;
  const [firstLo] = ranges[0] as [number, number];
  const [, lastHi] = ranges[last] as [number, number];
  if (value < firstLo) return { index: 0, shift: 0, notes: ["below-range"] };
  if (value > lastHi) return { index: last, shift: 0, notes: ["above-range"] };
  for (let i = 0; i <= last; i++) {
    const [lo, hi] = ranges[i] as [number, number];
    if (value >= lo && value <= hi) {
      const width = hi - lo;
      if (width > 0) {
        const t = (value - lo) / width;
        if (fit === "relaxed" && t >= 0.75 && i < last)
          return { index: i + 1, shift: 1, notes: ["between"] };
        if (fit === "slim" && t <= 0.25 && i > 0)
          return { index: i - 1, shift: -1, notes: ["between"] };
      }
      return { index: i, shift: 0, notes: [] };
    }
    const next = ranges[i + 1];
    if (next && value > hi && value < next[0]) {
      const t = (value - hi) / (next[0] - hi);
      const nearest = t < 0.5 ? i : i + 1;
      if (t <= 0.25 || t >= 0.75) return { index: nearest, shift: 0, notes: [] };
      if (fit === "slim") return { index: i, shift: nearest === i ? 0 : -1, notes: ["between"] };
      if (fit === "relaxed")
        return { index: i + 1, shift: nearest === i + 1 ? 0 : 1, notes: ["between"] };
      return { index: nearest, shift: 0, notes: ["between"] };
    }
  }
  return { index: last, shift: 0, notes: [] };
}

/** Zeilen auf die Grössen des Stücks einschränken und nach dem Mass ordnen. */
function usableRows(rows: MeasureRow[], ctx: FinderContext) {
  return rows
    .flatMap((row) => {
      const size = offered(row.size, ctx);
      return size ? [{ ...row, offered: size }] : [];
    })
    .filter((row, i, all) => all.findIndex((r) => r.offered.title === row.offered.title) === i)
    .sort((a, b) => a.range[0] - b.range[0] || a.range[1] - b.range[1]);
}

/** Konfektionsgrösse als Zahl (auch aus einem Buchstaben über die Zuordnung). */
function clothingNumber(title: string, letters: SizeLetters): number | undefined {
  const t = title.trim();
  if (isNumberSize(t)) return Number(t);
  const n = numberForLetter(t, letters);
  return n ? Number(n) : undefined;
}

function ok(
  size: FinderSize,
  basis: FinderBasis,
  step: Pick<Step, "shift" | "notes">,
  extra: FinderNote[],
): FinderResult {
  return {
    status: "ok",
    size: size.title,
    soldOut: !size.available,
    basis,
    shift: step.shift,
    notes: [...step.notes, ...extra],
  };
}

/** Empfehlung für ein Stück. */
export function findSize(input: FinderInput, ctx: FinderContext): FinderResult {
  const fit = input.fit ?? "regular";
  const sizes = ctx.sizes.filter((s) => !isOneSizeTitle(s.title));
  if (!sizes.length) return { status: "none", reason: "no-data", notes: [] };
  const context = { ...ctx, sizes };
  const extra: FinderNote[] = [];
  if (
    ctx.kind === "clothing" &&
    valid(input.height, 100, 250) &&
    (input.height < HEIGHT_MIN || input.height > HEIGHT_MAX)
  )
    extra.push("proportions");

  const usual = input.usual?.trim();
  const fromUsual = (): FinderResult | null => {
    if (!usual) return null;
    const size = offered(ctx.kind === "clothing" ? cleanLetter(usual) || usual : usual, context);
    return size
      ? ok(size, "usual", { shift: 0, notes: [] }, extra)
      : { status: "none", reason: "not-offered", notes: extra };
  };

  if (ctx.kind === "shoes") {
    if (valid(input.foot, 15, 40) && ctx.table) {
      // Kleinste Grösse, deren Fusslänge reicht (Toleranz 1 mm)
      const rows = usableRows(measureRows(ctx.table, "foot"), context);
      if (rows.length) {
        const foot = input.foot;
        const index = rows.findIndex((r) => r.range[1] >= foot - 0.1);
        const notes: FinderNote[] =
          index === -1
            ? ["above-range"]
            : index === 0 && foot < rows[0]!.range[0] - 0.5
              ? ["below-range"]
              : [];
        const row = rows[index === -1 ? rows.length - 1 : index]!;
        return ok(row.offered, "foot-table", { shift: 0, notes }, []);
      }
    }
    return fromUsual() ?? { status: "none", reason: "missing-input", notes: [] };
  }

  if (valid(input.chest, 60, 180)) {
    const rows = ctx.table ? usableRows(measureRows(ctx.table, "chest"), context) : [];
    if (rows.length >= 1) {
      const step = placeInRanges(
        input.chest,
        rows.map((r) => r.range),
        fit,
      );
      return ok(rows[step.index]!.offered, "chest-table", step, extra);
    }
    if (ctx.norm !== false) {
      // Norm: Normalgrösse ≈ halber Brustumfang (48 ↔ 96 cm)
      const norm = sizes
        .flatMap((s) => {
          const n = clothingNumber(s.title, ctx.letters);
          return n && n >= 40 && n <= 70
            ? [{ offered: s, range: [n * 2, n * 2] as [number, number] }]
            : [];
        })
        .sort((a, b) => a.range[0] - b.range[0]);
      if (norm.length) {
        const step = placeInRanges(
          input.chest,
          norm.map((r) => r.range),
          fit,
        );
        return ok(norm[step.index]!.offered, "chest-norm", step, extra);
      }
    }
  }

  const byUsual = fromUsual();
  if (byUsual) return byUsual;

  if (valid(input.height, 100, 250) && ctx.table) {
    const rows = usableRows(measureRows(ctx.table, "height"), context);
    if (rows.length) {
      // Bereiche überlappen oft (170–176, 173–179): die Grösse mit der nächsten Mitte
      const height = input.height;
      const centre = (r: (typeof rows)[number]) => (r.range[0] + r.range[1]) / 2;
      const best = rows.reduce((a, b) =>
        Math.abs(centre(b) - height) < Math.abs(centre(a) - height) ? b : a,
      );
      const notes: FinderNote[] = ["estimate"];
      if (height < rows[0]!.range[0]) notes.push("below-range");
      if (height > rows[rows.length - 1]!.range[1]) notes.push("above-range");
      return ok(best.offered, "height-table", { shift: 0, notes }, extra);
    }
  }
  return { status: "none", reason: "missing-input", notes: extra };
}

// --- Anbindung an Produkt und Tabellen -----------------------------------------------------------

/** Kategorien ohne Grössenfinder (Gürtel in cm, Socken, Krawatten …). */
const NO_FINDER_CATEGORIES: readonly string[] = ["accessoires"];

/** Art des Finders für ein Stück; null = kein Finder (Accessoires, Einheitsgrösse). */
export function finderKind(product: Pick<Product, "category" | "variants">): FinderKind | null {
  if (NO_FINDER_CATEGORIES.includes(product.category) || oneSizeVariant(product)) return null;
  return SHOE_CATEGORIES.includes(product.category) ? "shoes" : "clothing";
}

/** Tabelle für eine Kategorie: zuerst eine mit passender Spalte (Brust bzw. Fusslänge), sonst die erste. */
export function tableFor(
  tables: SizeGuideTable[],
  category: string,
  kind: FinderKind,
): SizeGuideTable | undefined {
  const matching = tables.filter(
    (t) => t.categories.length === 0 || t.categories.includes(category),
  );
  const wanted = kind === "shoes" ? "foot" : "chest";
  return (
    matching.find(
      (t) => t.categories.includes(category) && t.columns.some((c) => columnRole(c) === wanted),
    ) ??
    matching.find((t) => t.columns.some((c) => columnRole(c) === wanted)) ??
    matching.find((t) => t.categories.includes(category)) ??
    matching[0]
  );
}

/** Alles, was findSize für ein Stück braucht; null ohne Finder. */
export function productFinder(
  product: Pick<Product, "category" | "variants">,
  tables: SizeGuideTable[],
  letters: SizeLetters,
): FinderContext | null {
  const kind = finderKind(product);
  if (!kind) return null;
  return {
    kind,
    sizes: product.variants.map((v) => ({ title: v.title, available: v.availableForSale })),
    table: tableFor(tables, product.category, kind),
    letters,
    norm: !NO_LETTER_CATEGORIES.includes(product.category),
  };
}

/** Eingaben aus dem gespeicherten Profil für diese Art; null, wenn nichts Brauchbares gespeichert ist. */
export function profileInput(profile: SizeProfile, kind: FinderKind): FinderInput | null {
  if (kind === "shoes")
    return profile.foot || profile.shoeUsual
      ? { foot: profile.foot, usual: profile.shoeUsual }
      : null;
  return profile.height || profile.chest || profile.usual
    ? { height: profile.height, chest: profile.chest, usual: profile.usual, fit: profile.fit }
    : null;
}
