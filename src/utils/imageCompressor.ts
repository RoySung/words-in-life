import { loadImage } from './loadImage';

export async function compressImage(dataUrl: string, maxDimension = 1280, quality = .85, signal?: AbortSignal): Promise<string> {
  const image = await loadImage(dataUrl, signal);
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('瀏覽器無法處理照片，請重新載入後再試。');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}
