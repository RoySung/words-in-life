import type { PhotoRef } from '../domain/photos';
import type { LibraryRepository, PreparedPhoto } from './LibraryRepository';
import { AppError } from './LibraryRepository';

export async function preparePhoto(source?: string): Promise<{ ref?: PhotoRef; photos: PreparedPhoto[] }> {
  if (!source) return { photos: [] };
  if (/^\/(?!\/)/.test(source)) return { ref: { kind: 'asset', path: source }, photos: [] };
  if (!/^(data:image\/(jpeg|png|webp|gif);base64,|blob:|https?:\/\/)/.test(source)) throw new AppError('InvalidData');
  const response = await fetch(source);
  if (!response.ok) throw new AppError('Unavailable');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new AppError('InvalidData');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const id = `photo:${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')}`;
  return { ref: { kind: 'stored', photoId: id }, photos: [{ id, bytes, mimeType: blob.type }] };
}

/** Each image component holds a lease; deleting a record cannot revoke an open inspector. */
export function createPhotoUrls(repository: Pick<LibraryRepository, 'readPhoto'>) {
  let closed = false;
  const entries = new Map<string, { count: number; ready: Promise<string>; url?: string }>();
  return {
    acquire(ref: PhotoRef) {
      if (closed) throw new AppError('Unavailable');
      if (ref.kind === 'asset') return { ready: Promise.resolve(ref.path), release() {} };
      const key = ref.photoId;
      let entry = entries.get(key);
      if (!entry) {
        const created = { count: 0, ready: Promise.resolve(''), url: undefined as string | undefined };
        created.ready = repository.readPhoto(key).then(content => {
          created.url = URL.createObjectURL(new Blob([content.bytes.slice().buffer], { type: content.mimeType }));
          if (!created.count) { URL.revokeObjectURL(created.url); entries.delete(key); }
          return created.url;
        }).catch(cause => { if (entries.get(key) === created) entries.delete(key); throw cause; });
        entry = created; entries.set(key, entry);
      }
      entry.count++;
      let released = false;
      return { ready: entry.ready, release() {
        if (released) return; released = true;
        entry!.count--;
        if (!entry!.count && entry!.url) { URL.revokeObjectURL(entry!.url); entries.delete(key); }
      } };
    },
    close() { closed = true; entries.forEach(e => { e.count = 0; if (e.url) URL.revokeObjectURL(e.url); }); entries.clear(); },
  };
}
