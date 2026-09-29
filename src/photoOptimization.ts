import { db } from './db';

const MAX_SIDE = 1800;
const QUALITY = 0.82;
const MIN_SIZE_TO_OPTIMIZE = 700 * 1024;

function webpName(name: string) {
  return name.replace(/\.[^.]+$/, '') + '.webp';
}

async function compressImageBlob(blob: Blob): Promise<Blob | null> {
  if (!blob.type.startsWith('image/') || blob.type === 'image/gif' || blob.size < MIN_SIZE_TO_OPTIMIZE) return null;
  if (!('createImageBitmap' in window)) return null;

  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);
    const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', QUALITY));
    if (!compressed || compressed.size >= blob.size * 0.94) return null;
    return compressed;
  } finally {
    bitmap.close();
  }
}

export async function optimizeStoredPhotos() {
  const [eventPhotos, sheetPhotos] = await Promise.all([db.eventPhotos.toArray(), db.sheetPhotos.toArray()]);

  for (const photo of eventPhotos) {
    try {
      const compressed = await compressImageBlob(photo.blob);
      if (compressed) await db.eventPhotos.update(photo.id, { blob: compressed, type: 'image/webp', name: webpName(photo.name) });
    } catch {
      // One corrupt or unsupported image must never block the rest of the local library.
    }
  }

  for (const photo of sheetPhotos) {
    try {
      const compressed = await compressImageBlob(photo.blob);
      if (compressed) await db.sheetPhotos.update(photo.id, { blob: compressed, type: 'image/webp', name: webpName(photo.name) });
    } catch {
      // Keep the original if the browser cannot optimize it safely.
    }
  }
}
