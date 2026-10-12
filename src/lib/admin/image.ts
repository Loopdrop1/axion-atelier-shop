// Bilder vor dem Hochladen im Browser verkleinern: längere Seite höchstens 2000 px, WebP (sonst JPEG).
// Spart Speicher und Ladezeit; Originale vom Handy haben oft 4000 px und mehr als 5 MB.

export const MAX_IMAGE_SIDE = 2000;

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
  extension: "webp" | "jpg";
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImage(file: File, max = MAX_IMAGE_SIDE): Promise<PreparedImage> {
  if (!/^image\/(jpeg|png|webp|avif|heic|heif)$/.test(file.type) && file.type !== "")
    throw new Error("UNSUPPORTED_TYPE");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => {
    throw new Error("UNREADABLE_IMAGE");
  });
  const size = targetSize(bitmap.width, bitmap.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("UNREADABLE_IMAGE");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  // Safari kann teils kein WebP erzeugen und liefert dann PNG: in dem Fall JPEG.
  const webp = await canvasToBlob(canvas, "image/webp", 0.86);
  if (webp && webp.type === "image/webp") return { blob: webp, ...size, extension: "webp" };
  const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.86);
  if (!jpeg) throw new Error("UNREADABLE_IMAGE");
  return { blob: jpeg, ...size, extension: "jpg" };
}
