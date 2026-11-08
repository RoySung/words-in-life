import type { DetectedItem } from '../types';
import type { PhotoRef } from '../domain/photos';
import type { PhotoUrls } from '../hooks/usePhotoUrl';
import { parseBoundingBox } from '../domain/validation';
import { loadImage } from './loadImage';
import { drawObjectCrop } from './stickerGenerator';
import { SHARE_PHOTO_SIZE } from './wordShareLayout';

/** Rebuild the existing crop at export resolution; old crop-only records still work. */
export async function createWordSharePhoto(item: DetectedItem, urls?: PhotoUrls, sceneSource?: string, signal?: AbortSignal): Promise<string> {
  const boundingBox = parseBoundingBox(item.boundingBox);
  const originals: { photo?: PhotoRef; source?: string; original: boolean }[] = [
    { photo: item.photo, original: true },
    { source: item.originalImageUrl, original: true },
    { source: sceneSource, original: true },
  ];
  const crops: typeof originals = [
    { photo: item.crop, original: false },
    { source: item.stickerUrl, original: false },
  ];
  // Rebuilding a crop requires its bounds; otherwise preserve the saved crop first.
  const candidates = boundingBox ? [...originals, ...crops] : [...crops, ...originals];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    signal?.throwIfAborted();
    if (!candidate.photo && !candidate.source) continue;
    const key = candidate.photo?.kind === 'stored' ? `stored:${candidate.photo.photoId}` : candidate.photo?.kind === 'asset' ? candidate.photo.path : candidate.source!;
    if (seen.has(key)) continue;
    seen.add(key);
    let lease: ReturnType<PhotoUrls['acquire']> | undefined;
    try {
      let source = candidate.source;
      if (candidate.photo?.kind === 'asset') source = candidate.photo.path;
      else if (candidate.photo) {
        if (!urls) continue;
        lease = urls.acquire(candidate.photo);
        source = await lease.ready;
      }
      const image = await loadImage(source!, signal);
      const canvas = document.createElement('canvas');
      canvas.width = candidate.original ? SHARE_PHOTO_SIZE : image.naturalWidth;
      canvas.height = candidate.original ? SHARE_PHOTO_SIZE : image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('無法裁切分享照片');
      if (candidate.original) drawObjectCrop(image, context, canvas.width, boundingBox);
      else context.drawImage(image, 0, 0);
      return canvas.toDataURL('image/png');
    } catch {
      signal?.throwIfAborted();
      // A missing original must not prevent sharing an existing thumbnail.
    } finally { lease?.release(); }
  }
  throw new Error('無法讀取分享照片');
}
