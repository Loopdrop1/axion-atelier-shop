// Bilder vor dem Hochladen im Browser verkleinern: längere Seite höchstens 2000 px, WebP (sonst JPEG).
// Spart Speicher und Ladezeit; Originale vom Handy haben oft 4000 px und mehr als 5 MB.
// Freigestellte Bilder (durchsichtiger Hintergrund) bleiben durchsichtig: WebP, sonst PNG statt JPEG.

export const MAX_IMAGE_SIDE = 2000;
/** Unter dieser längeren Seite wirkt ein Bild im Shop unscharf: Der Upload warnt. */
export const MIN_IMAGE_SIDE = 1600;
/** Grenze der Speicher-Buckets für Bilder (product-images, site-media) */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function targetSize(width: number, height: number, max = MAX_IMAGE_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
  extension: "webp" | "jpg" | "png";
  /** Original war kleiner als MIN_IMAGE_SIDE (längere Seite) */
  lowRes: boolean;
}

/** Hat das Bild durchsichtige Stellen? (Stichprobe, reicht für freigestellte Produktfotos) */
export function hasTransparency(
  ctx: Pick<CanvasRenderingContext2D, "getImageData">,
  width: number,
  height: number,
): boolean {
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4 * 7) if ((data[i] ?? 255) < 250) return true;
  return false;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Verkleinerte Fassung als PNG (für freigestellte Bilder, die als PNG zu gross werden) */
async function smallerPng(
  source: HTMLCanvasElement,
  size: { width: number; height: number },
  factor: number,
): Promise<{ blob: Blob; width: number; height: number } | null> {
  const next = targetSize(
    size.width,
    size.height,
    Math.round(Math.max(size.width, size.height) * factor),
  );
  const canvas = document.createElement("canvas");
  canvas.width = next.width;
  canvas.height = next.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, next.width, next.height);
  const blob = await canvasToBlob(canvas, "image/png", 1);
  return blob ? { blob, ...next } : null;
}

export async function prepareImage(file: File, max = MAX_IMAGE_SIDE): Promise<PreparedImage> {
  if (!/^image\/(jpeg|png|webp|avif|heic|heif)$/.test(file.type) && file.type !== "")
    throw new Error("UNSUPPORTED_TYPE");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => {
    throw new Error("UNREADABLE_IMAGE");
  });
  const size = targetSize(bitmap.width, bitmap.height, max);
  const lowRes = Math.max(bitmap.width, bitmap.height) < MIN_IMAGE_SIDE;
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("UNREADABLE_IMAGE");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  // Safari kann teils kein WebP erzeugen und liefert dann PNG: in dem Fall JPEG, bei freigestellten Bildern PNG.
  const webp = await canvasToBlob(canvas, "image/webp", 0.86);
  if (webp && webp.type === "image/webp") return { blob: webp, ...size, extension: "webp", lowRes };
  if (webp && webp.type === "image/png" && hasTransparency(ctx, size.width, size.height)) {
    // PNG wird bei grossen Fotos schnell grösser als der Speicher erlaubt: dann schrittweise kleiner
    let best = { blob: webp, ...size };
    for (const factor of [0.8, 0.64, 0.5]) {
      if (best.blob.size <= MAX_IMAGE_BYTES) break;
      best = (await smallerPng(canvas, size, factor)) ?? best;
    }
    return { ...best, extension: "png", lowRes };
  }
  const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.86);
  if (!jpeg) throw new Error("UNREADABLE_IMAGE");
  return { blob: jpeg, ...size, extension: "jpg", lowRes };
}
