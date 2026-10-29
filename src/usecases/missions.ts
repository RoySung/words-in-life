import { completeMission, getTodayDateKey, lockMissions, rollDate } from '../domain/missions';
import type { VocabularyItem } from '../domain/vocabulary';
import type { PhotoRef } from '../domain/photos';
import type { PreparedPhoto } from '../repository/LibraryRepository';
import type { Dependencies, Execute } from './library';
export function missionUsecases(execute: Execute, deps: Dependencies) {
  return {
    startMission: (id: string) => execute(deps.createId(), [], state => {
      const current = rollDate(state.daily, getTodayDateKey(new Date(deps.now())));
      const daily = current.missions.some(m => m.id === id && !m.isCompleted) ? lockMissions(current, deps.now(), 'started') : current;
      return daily === state.daily ? null : { changes: { daily }, result: { kind: 'day' } };
    }),
    ensureMissionDay: () => {
      const today = getTodayDateKey(new Date(deps.now()));
      return execute(deps.createId(), [], state => {
        const daily = rollDate(state.daily, today);
        return daily === state.daily ? null : { changes: { daily }, result: { kind: 'day' } };
      });
    },
    completeMission: (input: { items: VocabularyItem[]; photo?: PhotoRef; crops?: Record<string, PhotoRef | undefined>; photos?: PreparedPhoto[]; targetId?: string; analysisId: string; signal?: AbortSignal }) => {
      const now = new Date(deps.now());
      return execute(`analysis:${input.analysisId}`, input.photos || [], state => {
        const result = completeMission(state.daily, input.items, input.photo, input.targetId, now, input.crops);
        return { changes: result.state === state.daily ? {} : { daily: result.state }, result: {
          kind: 'mission', missionId: result.celebration?.mission.id, matchedItemId: result.celebration?.matchedItem.id,
        } };
      }, input.signal);
    },
  };
}
