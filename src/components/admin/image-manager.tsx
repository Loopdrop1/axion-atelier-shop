// Produktbilder: hochladen (automatisch verkleinert), Reihenfolge, Bildbeschreibung DE/EN, löschen.
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteImage,
  translateTexts,
  updateImage,
  uploadProductImage,
  type Product,
  type ProductImage,
} from "@/lib/admin/api";
import { autoList, autoSet, autoTranslate, type TextPair } from "@/lib/admin/auto-translate";
import { imageUrl } from "@/lib/commerce/mapping";
import { ConfirmButton, notify, Panel } from "./ui";

export function ImageManager({
  product,
  images,
  onChange,
}: {
  product: Pick<Product, "id" | "handle" | "title_de" | "title_en" | "en_auto">;
  images: ProductImage[];
  onChange: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [alts, setAlts] = useState<Record<string, { alt_de: string; alt_en: string }>>({});
  // Zuletzt gespeicherter Stand pro Bild (die Liste lädt erst danach neu) und laufende Speichervorgänge:
  // Pro Bild speichert immer nur ein Vorgang, die Felder sind solange gesperrt.
  const saved = useRef<Record<string, TextPair>>({});
  const inFlight = useRef(new Set<string>());
  const [saving, setSaving] = useState<string[]>([]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files];
    let sort = Math.max(0, ...images.map((i) => i.sort)) + 10;
    let done = 0;
    for (const file of list) {
      setProgress(`Bild ${done + 1} von ${list.length} wird verkleinert und hochgeladen …`);
      try {
        await uploadProductImage(product, file, sort);
        sort += 10;
        done += 1;
      } catch (error) {
        notify.error(error);
      }
    }
    setProgress(null);
    if (input.current) input.current.value = "";
    if (done) notify.ok(done === 1 ? "Bild hochgeladen." : `${done} Bilder hochgeladen.`);
    onChange();
  }

  async function move(index: number, direction: -1 | 1) {
    const a = images[index];
    const b = images[index + direction];
    if (!a || !b) return;
    try {
      // Reihenfolge tauschen; gleiche Werte vorher auseinanderziehen
      const sa = a.sort === b.sort ? index * 10 : a.sort;
      const sb = a.sort === b.sort ? (index + direction) * 10 : b.sort;
      await Promise.all([updateImage(a.id, { sort: sb }), updateImage(b.id, { sort: sa })]);
      onChange();
    } catch (error) {
      notify.error(error);
    }
  }

  const savedAlt = (image: ProductImage): TextPair =>
    saved.current[image.id] ?? {
      de: image.alt_de,
      en: image.alt_en ?? "",
      auto: autoSet(image.en_auto).has("alt"),
    };

  async function saveAlt(image: ProductImage) {
    const alt = alts[image.id];
    if (!alt || inFlight.current.has(image.id)) return;
    const before = savedAlt(image);
    if (alt.alt_de.trim() === before.de.trim() && alt.alt_en.trim() === before.en.trim()) return;
    inFlight.current.add(image.id);
    setSaving((list) => [...list, image.id]);
    try {
      const translation = await autoTranslate(
        { alt: before },
        { alt: { de: alt.alt_de, en: alt.alt_en } },
        translateTexts,
        { alt: 300 },
      );
      const pair = translation.pairs["alt"]!;
      await updateImage(image.id, {
        alt_de: alt.alt_de.trim(),
        alt_en: pair.en.trim() || null,
        en_auto: autoList(translation.pairs),
      });
      saved.current[image.id] = {
        de: alt.alt_de.trim(),
        en: pair.en.trim(),
        auto: Boolean(pair.auto),
      };
      setAlts((a) => ({ ...a, [image.id]: { alt_de: alt.alt_de, alt_en: pair.en } }));
      notify.saved("Bildbeschreibung gespeichert.", translation);
      onChange();
    } catch (error) {
      notify.error(error);
    } finally {
      inFlight.current.delete(image.id);
      setSaving((list) => list.filter((id) => id !== image.id));
    }
  }

  return (
    <Panel
      title="Bilder"
      description="Das erste Bild erscheint in Listen, das zweite beim Darüberfahren. Hochformat 4:5 empfohlen. Grosse Bilder werden vor dem Hochladen auf höchstens 2000 px verkleinert."
      actions={
        <>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            hidden
            onChange={(e) => void upload(e.target.files)}
          />
          <Button
            variant="admin"
            disabled={Boolean(progress)}
            onClick={() => input.current?.click()}
          >
            <Upload /> Bilder hochladen
          </Button>
        </>
      }
    >
      {progress && (
        <p className="admin-muted" role="status">
          {progress}
        </p>
      )}
      {images.length === 0 ? (
        <p className="admin-empty">
          Noch keine Bilder. Ohne Bild zeigt der Shop einen Platzhalter.
        </p>
      ) : (
        <ul className="admin-images">
          {images.map((image, index) => {
            const alt = alts[image.id] ?? { alt_de: image.alt_de, alt_en: image.alt_en ?? "" };
            const src = imageUrl(image.path, "product-images");
            return (
              <li key={image.id}>
                <div className="admin-image-frame">
                  {src ? <img src={src} alt={image.alt_de} loading="lazy" /> : null}
                  <span className="admin-image-pos">{index + 1}</span>
                </div>
                <Input
                  aria-label={`Bildbeschreibung Deutsch, Bild ${index + 1}`}
                  placeholder="Bildbeschreibung (Deutsch)"
                  maxLength={300}
                  disabled={saving.includes(image.id)}
                  value={alt.alt_de}
                  onChange={(e) =>
                    setAlts((a) => ({ ...a, [image.id]: { ...alt, alt_de: e.target.value } }))
                  }
                  onBlur={() => void saveAlt(image)}
                />
                <Input
                  aria-label={`Bildbeschreibung Englisch, Bild ${index + 1}`}
                  placeholder="Image description (English)"
                  maxLength={300}
                  disabled={saving.includes(image.id)}
                  value={alt.alt_en}
                  onChange={(e) =>
                    setAlts((a) => ({ ...a, [image.id]: { ...alt, alt_en: e.target.value } }))
                  }
                  onBlur={() => void saveAlt(image)}
                />
                <div className="admin-image-actions">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Nach vorne"
                    disabled={index === 0}
                    onClick={() => void move(index, -1)}
                  >
                    <ArrowLeft />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Nach hinten"
                    disabled={index === images.length - 1}
                    onClick={() => void move(index, 1)}
                  >
                    <ArrowRight />
                  </Button>
                  <ConfirmButton
                    label="Löschen"
                    variant="ghost"
                    title="Bild löschen?"
                    description="Das Bild wird aus dem Shop und aus dem Speicher entfernt."
                    confirmLabel="Löschen"
                    onConfirm={async () => {
                      await deleteImage(image);
                      notify.ok("Bild gelöscht.");
                      onChange();
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
