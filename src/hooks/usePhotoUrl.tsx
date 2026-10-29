import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import type { PhotoRef } from '../domain/photos';
import type { createPhotoUrls } from '../repository/photos';
export type PhotoUrls = ReturnType<typeof createPhotoUrls>;
export function usePhotoUrl(ref?: PhotoRef, fallback?: string, urls?: PhotoUrls) {
  const key = ref?.kind === 'stored' ? ref.photoId : ref?.path;
  const [loaded, setLoaded] = useState<{ key: string; url: string }>();
  useEffect(() => {
    if (!ref || !urls || !key || ref.kind === 'asset') return;
    let active = true;
    const lease = urls.acquire(ref);
    void lease.ready.then(url => { if (active) setLoaded({ key, url }); }).catch(() => {});
    return () => { active = false; lease.release(); };
  }, [key, urls]);
  return ref?.kind === 'asset' ? ref.path : loaded?.key === key ? loaded?.url : fallback;
}
export function PhotoImage({ photo, urls, src, ...props }: ImgHTMLAttributes<HTMLImageElement> & { photo?: PhotoRef; urls?: PhotoUrls }) {
  const source = usePhotoUrl(photo, typeof src === 'string' ? src : undefined, urls);
  return <img {...props} src={source || undefined} />;
}
