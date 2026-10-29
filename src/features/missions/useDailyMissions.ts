import { useEffect } from 'react';
import type { DetectedItem } from '../../types';
import type { LibraryStore } from '../../hooks/useLibrary';
import { getTodayDateKey, rollDate } from '../../domain/missions';
import { preparePhoto } from '../../repository/photos';

export function useDailyMissions(store: LibraryStore, exploring = false) {
  const { run, services } = store;
  useEffect(() => {
    const refresh = () => { void run(async () => {
      await services.library.ensureMissionDay();
      if (exploring) await services.missionGeneration.ensure();
    }); };
    const visible = () => { if (!document.hidden) refresh(); };
    refresh(); const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [run, services, exploring]);
  const complete = async (items: DetectedItem[], source: string, analysisId: string, targetId?: string, signal?: AbortSignal) => {
    const committed = await run(async () => {
      signal?.throwIfAborted();
      const photo = await preparePhoto(source);
      const crops = await Promise.all(items.map(async item => ({ id: item.id, ...await preparePhoto(item.stickerUrl) })));
      signal?.throwIfAborted();
      return services.library.completeMission({ items, photo: photo.ref, crops: Object.fromEntries(crops.map(c => [c.id, c.ref])),
        photos: [...photo.photos, ...crops.flatMap(c => c.photos)], targetId, analysisId, signal });
    });
    const mission = committed?.snapshot.daily.missions.find(m => m.id === committed.result?.missionId);
    const matchedItem = items.find(item => item.id === committed?.result?.matchedItemId);
    return mission && matchedItem ? { mission, matchedItem } : null;
  };
  return { ...rollDate(store.library!.daily, getTodayDateKey()), complete };
}
