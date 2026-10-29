import type { DetectedItem } from '../types';
import { loadImage } from './loadImage';

function crop(image: HTMLImageElement, position: { x: number; y: number }, ratio = .32): string {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const size = Math.min(Math.min(width, height), Math.max(120, Math.min(width, height) * ratio));
  const x = Math.max(0, Math.min(width - size, Math.max(5, Math.min(95, position.x)) / 100 * width - size / 2));
  const y = Math.max(0, Math.min(height - size, Math.max(5, Math.min(95, position.y)) / 100 * height - size / 2));
  const canvas = document.createElement('canvas'); canvas.width = 280; canvas.height = 280;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('無法裁切照片');
  context.drawImage(image, x, y, size, size, 0, 0, 280, 280);
  return canvas.toDataURL('image/jpeg', .9);
}

export async function generateSticker(imageUrl: string, position: { x: number; y: number }, cropRatio = .32): Promise<string> {
  try { return crop(await loadImage(imageUrl), position, cropRatio); }
  catch { return imageUrl; }
}

/** Decode one source once for all objects, instead of decoding the full photo per crop. */
export async function batchGenerateStickers(imageUrl: string, items: DetectedItem[], signal?: AbortSignal): Promise<DetectedItem[]> {
  signal?.throwIfAborted();
  const image = items.some(item => !item.stickerUrl) ? await loadImage(imageUrl, signal) : null;
  return items.map(item => {
    signal?.throwIfAborted();
    let stickerUrl = item.stickerUrl;
    if (!stickerUrl && image) {
      try { stickerUrl = crop(image, item.position); } catch { stickerUrl = imageUrl; }
    }
    return { ...item, stickerUrl, originalImageUrl: item.originalImageUrl || imageUrl };
  });
}
