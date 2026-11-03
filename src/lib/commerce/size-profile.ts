// Angaben aus dem Grössenfinder, nur im Browser (localStorage). Nichts davon geht an den Server.
// Lesen erst nach dem Einbinden (useSizeProfile), damit Server und Browser dasselbe zeigen.
import { useEffect, useState } from "react";
import type { FitWish } from "./size-finder";

export interface SizeProfile {
  /** Kleidung */
  height?: number | undefined;
  chest?: number | undefined;
  usual?: string | undefined;
  fit?: FitWish | undefined;
  /** Schuhe */
  foot?: number | undefined;
  shoeUsual?: string | undefined;
}

const KEY = "axion-size-profile";
const EVENT = "axion-size-profile";
const FITS: readonly FitWish[] = ["slim", "regular", "relaxed"];

const num = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
const text = (v: unknown) =>
  typeof v === "string" && v.trim() && v.length <= 10 ? v.trim() : undefined;

/** Gespeicherte Angaben prüfen; Unbekanntes und Unsinn fallen weg. */
export function cleanProfile(value: unknown): SizeProfile {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  const profile: SizeProfile = {
    height: num(v["height"], 100, 250),
    chest: num(v["chest"], 60, 180),
    usual: text(v["usual"]),
    fit: FITS.includes(v["fit"] as FitWish) ? (v["fit"] as FitWish) : undefined,
    foot: num(v["foot"], 15, 40),
    shoeUsual: text(v["shoeUsual"]),
  };
  return Object.fromEntries(
    Object.entries(profile).filter(([, x]) => x !== undefined),
  ) as SizeProfile;
}

export function readProfile(): SizeProfile {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? cleanProfile(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

/** Speichert (zusammengeführt mit dem Bestehenden); leeres Profil löscht den Eintrag. */
export function writeProfile(change: SizeProfile | null) {
  try {
    const next = change ? cleanProfile({ ...readProfile(), ...change }) : {};
    if (Object.keys(next).length) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Privates Fenster oder gesperrter Speicher: der Finder funktioniert trotzdem, merkt sich nur nichts
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Angaben des Grössenfinders; null bis nach dem Einbinden. */
export function useSizeProfile(): SizeProfile | null {
  const [profile, setProfile] = useState<SizeProfile | null>(null);
  useEffect(() => {
    const update = () => setProfile(readProfile());
    update();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === KEY) update();
    };
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return profile;
}
