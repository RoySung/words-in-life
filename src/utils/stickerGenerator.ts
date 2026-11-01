import type { DetectedItem } from '../types';
import { loadImage } from './loadImage';
import type { BoundingBox } from '../domain/vocabulary';
import { parseBoundingBox } from '../domain/validation';

/** Fit the whole padded object into a square; unknown bounds retain the full scene. */
function crop(image: HTMLImageElement, boundingBox?: BoundingBox): string {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const box = parseBoundingBox(boundingBox) || { left: 0, top: 0, right: 100, bottom: 100 };
  const padX = (box.right - box.left) * .1;
  const padY = (box.bottom - box.top) * .1;
  const x = Math.max(0, box.left - padX) / 100 * width;
  const y = Math.max(0, box.top - padY) / 100 * height;
  const cropWidth = Math.min(width, (box.right + padX) / 100 * width) - x;
  const cropHeight = Math.min(height, (box.bottom + padY) / 100 * height) - y;
  const canvas = document.createElement('canvas'); canvas.width = 280; canvas.height = 280;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('無法裁切照片');
  context.fillStyle = '#fff9ef';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / cropWidth, canvas.height / cropHeight);
  const outputWidth = cropWidth * scale;
  const outputHeight = cropHeight * scale;
  context.drawImage(image, x, y, cropWidth, cropHeight,
    (canvas.width - outputWidth) / 2, (canvas.height - outputHeight) / 2, outputWidth, outputHeight);
  return canvas.toDataURL('image/jpeg', .9);
}

export async function generateSticker(imageUrl: string, boundingBox?: BoundingBox): Promise<string> {
  try { return crop(await loadImage(imageUrl), boundingBox); }
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
      try { stickerUrl = crop(image, item.boundingBox); } catch { stickerUrl = imageUrl; }
    }
    return { ...item, stickerUrl, originalImageUrl: item.originalImageUrl || imageUrl };
  });
}
