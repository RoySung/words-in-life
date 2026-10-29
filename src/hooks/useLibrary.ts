import { useCallback, useEffect, useRef, useState } from 'react';
import type { Services } from '../createServices';
import type { LibrarySnapshot } from '../repository/LibraryRepository';
import type { SavedWord, DailyMission } from '../types';
import { errorMessage } from '../utils/errorMessage';
import type { PhotoRef } from '../domain/photos';
const asset = (ref?: PhotoRef) => ref?.kind === 'asset' ? ref.path : undefined;
function view(snapshot: LibrarySnapshot) {
  return { ...snapshot, words: snapshot.words.map(w => ({ ...w, imageUrl: asset(w.photo), originalImageUrl: asset(w.photo), stickerUrl: asset(w.crop) })) as SavedWord[],
    daily: { ...snapshot.daily, missions: snapshot.daily.missions.map(m => ({ ...m, completedPhotoUrl: asset(m.completedPhoto), completedStickerUrl: asset(m.completedCrop) })) as DailyMission[] } };
}
export function useLibrary(services: Services) {
  const [library, setLibrary] = useState<ReturnType<typeof view> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const active = useRef(false);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    const snapshot = await services.library.load();
    if (active.current && request === generation.current) setLibrary(view(snapshot));
  }, [services]);
  useEffect(() => {
    active.current = true;
    let disposed = false;
    setLoading(true); setError('');
    (async () => {
      try { await services.initialize(); if (!disposed) await refresh(); }
      catch (cause) { if (!disposed) setError(errorMessage(cause)); }
      finally { if (!disposed) setLoading(false); }
    })();
    const reload = () => { void refresh().catch(cause => { if (!disposed) setError(errorMessage(cause)); }); };
    const unsubscribe = services.library.subscribe(reload);
    const visible = () => { if (!document.hidden) reload(); };
    window.addEventListener('focus', reload); document.addEventListener('visibilitychange', visible);
    return () => { disposed = true; active.current = false; generation.current++; unsubscribe(); window.removeEventListener('focus', reload); document.removeEventListener('visibilitychange', visible); };
  }, [services, refresh, attempt]);
  const run = useCallback(async <T,>(operation: () => Promise<T>): Promise<T | undefined> => {
    try {
      const result = await operation();
      if (active.current) { await refresh(); setError(''); }
      return result;
    } catch (cause) { if (active.current) setError(errorMessage(cause)); return undefined; }
  }, [refresh]);
  return { library, loading, error, run, refresh, services, dismissError: () => setError(''), retry: () => setAttempt(n => n + 1) };
}
export type LibraryStore = ReturnType<typeof useLibrary>;
