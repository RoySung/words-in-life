import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { ImageOff } from 'lucide-react';
import type { PhotoRef } from '../domain/photos';
import type { createPhotoUrls } from '../repository/photos';
export type PhotoUrls = ReturnType<typeof createPhotoUrls>;
function usePhotoResource(ref?: PhotoRef, source?: string, urls?: PhotoUrls) {
  const key = ref?.kind === 'stored' ? ref.photoId : ref?.path;
  const [loaded, setLoaded] = useState<{ key: string; owner: PhotoUrls; url?: string; failed?: boolean }>();
  useEffect(() => {
    if (!ref || !urls || !key || ref.kind === 'asset') return;
    let active = true;
    let lease: ReturnType<PhotoUrls['acquire']> | undefined;
    try {
      lease = urls.acquire(ref);
      void lease.ready.then(url => { if (active) setLoaded({ key, owner: urls, url }); })
        .catch(() => { if (active) setLoaded({ key, owner: urls, failed: true }); });
    } catch { setLoaded({ key, owner: urls, failed: true }); }
    return () => { active = false; lease?.release(); };
  }, [key, urls]);
  if (ref?.kind === 'asset') return { source: ref.path, pending: false, failed: false };
  if (!ref) return { source, pending: false, failed: !source };
  if (!urls) return { pending: false, failed: true };
  if (loaded?.key === key && loaded?.owner === urls) return { source: loaded.url, pending: false, failed: loaded.failed };
  return { pending: true, failed: false };
}
export function usePhotoUrl(ref?: PhotoRef, fallback?: string, urls?: PhotoUrls) {
  return usePhotoResource(ref, fallback, urls).source || fallback;
}

export type PhotoImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  photo?: PhotoRef; urls?: PhotoUrls; fallbackPhoto?: PhotoRef; fallbackSrc?: string;
};
type Candidate = { photo?: PhotoRef; src?: string };
const candidateKey = (candidate: Candidate) => candidate.photo?.kind === 'stored' ? `stored:${candidate.photo.photoId}` : candidate.photo?.kind === 'asset' ? `url:${candidate.photo.path}` : `url:${candidate.src}`;

function PhotoAttempt({ candidates, urls, ...props }: Omit<PhotoImageProps, 'photo' | 'src' | 'fallbackPhoto' | 'fallbackSrc'> & { candidates: Candidate[] }) {
  const [failed, setFailed] = useState(false);
  const candidate = candidates[0];
  const resource = usePhotoResource(failed ? undefined : candidate?.photo, failed ? undefined : candidate?.src, urls);
  if (!candidate || failed || resource.failed) {
    if (candidates.length > 1) return <PhotoAttempt key={candidateKey(candidates[1])} candidates={candidates.slice(1)} urls={urls} {...props} />;
    return <span className={`photo-unavailable ${props.className || ''}`} style={props.style} role="img" aria-label={`${props.alt || '照片'}：照片無法載入`}><ImageOff aria-hidden="true" /><span>照片無法載入</span></span>;
  }
  if (resource.pending) return <span className={`photo-loading ${props.className || ''}`} style={props.style} role="status" aria-label="照片載入中" />;
  return <img {...props} src={resource.source} onError={event => { setFailed(true); props.onError?.(event); }} />;
}

/** Try each source once, acquiring the original photo only if the crop fails. */
export function PhotoImage({ photo, urls, src, fallbackPhoto, fallbackSrc, ...props }: PhotoImageProps) {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (const candidate of [photo && { photo }, src && { src }, fallbackPhoto && { photo: fallbackPhoto }, fallbackSrc && { src: fallbackSrc }]) {
    if (!candidate) continue;
    const key = candidateKey(candidate);
    if (!seen.has(key)) { seen.add(key); candidates.push(candidate); }
  }
  return <PhotoAttempt key={candidates[0] ? candidateKey(candidates[0]) : 'missing'} candidates={candidates} urls={urls} {...props} />;
}
