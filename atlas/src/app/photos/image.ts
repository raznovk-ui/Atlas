/**
 * Canvas re-encoding. Drawing an image to a canvas and reading it back drops
 * every metadata block, which is exactly what stripping EXIF requires: a photo
 * of a street contains people, and an exported file should not carry the place
 * and time they were there.
 */
const THUMBNAIL_MAX = 320;

async function loadBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Image illisible"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toCanvas(source: ImageBitmap | HTMLImageElement, maxSize?: number) {
  const width = "width" in source ? source.width : 0;
  const height = "height" in source ? source.height : 0;
  const scale = maxSize ? Math.min(1, maxSize / Math.max(width, height)) : 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponible");
  context.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encodage impossible"))),
      "image/jpeg",
      quality,
    );
  });
}

export async function makeThumbnail(file: Blob): Promise<Blob> {
  const bitmap = await loadBitmap(file);
  return toBlob(toCanvas(bitmap, THUMBNAIL_MAX), 0.7);
}

/** Re-encodes at full size, discarding EXIF. Used for export. */
export async function stripExif(file: Blob): Promise<Blob> {
  const bitmap = await loadBitmap(file);
  return toBlob(toCanvas(bitmap), 0.92);
}
