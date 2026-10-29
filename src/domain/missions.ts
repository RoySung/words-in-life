import type { PhotoRef } from './photos';
import type { VocabularyItem } from './vocabulary';
import { MISSION_POOL } from './missionPool';
import { wordKey } from './validation';

export interface DailyMission {
  id: string;
  targetWord: string;
  targetChinese: string;
  phonetic: string;
  partOfSpeech: string;
  emoji: string;
  hint: string;
  synonyms: string[]; // Related words or collocations that also fulfill the mission
  kind?: 'review' | 'new';
  reason?: string;
  isCompleted: boolean;
  completedAt?: number;
  completedCrop?: PhotoRef;
  completedPhoto?: PhotoRef;
}

// Helper: Get today's local date string YYYY-MM-DD
export function getTodayDateKey(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Generate 3 deterministic daily missions for a given date
export function generateDailyMissionsForDate(dateKey: string): DailyMission[] {
  // Simple deterministic hash based on date string
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash << 5) - hash + dateKey.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);

  const poolLen = MISSION_POOL.length;
  const idx1 = absHash % poolLen;
  const idx2 = (absHash * 7 + 3) % poolLen;
  const idx3 = (absHash * 13 + 7) % poolLen;

  // Ensure unique indexes
  const selectedIdxs = [idx1];
  if (!selectedIdxs.includes(idx2)) selectedIdxs.push(idx2);
  else selectedIdxs.push((idx2 + 1) % poolLen);

  if (!selectedIdxs.includes(idx3)) selectedIdxs.push(idx3);
  else {
    let next = (idx3 + 1) % poolLen;
    while (selectedIdxs.includes(next)) next = (next + 1) % poolLen;
    selectedIdxs.push(next);
  }

  return selectedIdxs.map((poolIdx, i) => {
    const item = MISSION_POOL[poolIdx];
    return {
      ...item,
      id: `${dateKey}_m${i}_${item.targetWord}`,
      isCompleted: false,
    };
  });
}

// Only explicit object names and aliases count; example phrases are not observations.
export function checkMissionMatch(mission: DailyMission, items: VocabularyItem[]): VocabularyItem | null {
  const targets = new Set([mission.targetWord, ...mission.synonyms].map(wordKey));
  return items.find(item => targets.has(wordKey(item.word))) || null;
}

export interface MissionState {
  dateKey: string;
  missions: DailyMission[];
  streak: number;
  lastCompletedDate: string | null;
  generation?: MissionGeneration;
}
export type MissionFallbackReason = 'missing-key' | 'generation-failed' | 'started' | 'interrupted';
export type MissionGeneration =
  | { status: 'pending' }
  | { status: 'generating'; requestId: string; startedAt: number }
  | { status: 'ready'; source: 'ai' | 'fallback'; generatedAt: number; fallbackReason?: MissionFallbackReason };
export function lockMissions(state: MissionState, now: number, fallbackReason: MissionFallbackReason): MissionState {
  return state.generation?.status === 'ready' ? state : { ...state, generation: { status: 'ready', source: 'fallback', generatedAt: now, fallbackReason } };
}
export function yesterday(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return getTodayDateKey(new Date(year, month - 1, day - 1, 12));
}
export function freshMissions(dateKey = getTodayDateKey()): MissionState {
  return { dateKey, missions: generateDailyMissionsForDate(dateKey), streak: 0, lastCompletedDate: null, generation: { status: 'pending' } };
}
export function rollDate(state: MissionState, today = getTodayDateKey()): MissionState {
  const streak = state.lastCompletedDate === today || state.lastCompletedDate === yesterday(today) ? state.streak : 0;
  if (state.dateKey === today && streak === state.streak) return state;
  return { ...state, dateKey: today, streak, missions: state.dateKey === today ? state.missions : generateDailyMissionsForDate(today), generation: state.dateKey === today ? state.generation : { status: 'pending' } };
}
export function completeMission(state: MissionState, items: VocabularyItem[], photo: PhotoRef | undefined, targetId?: string, now = new Date(), crops: Record<string, PhotoRef | undefined> = {}) {
  const current = rollDate(state, getTodayDateKey(now));
  const pending = current.missions.filter(m => !m.isCompleted);
  const ordered = [...pending.filter(m => m.id === targetId), ...pending.filter(m => m.id !== targetId)];
  for (const mission of ordered) {
    const matchedItem = checkMissionMatch(mission, items);
    if (!matchedItem) continue;
    const missions = current.missions.map(m => m.id === mission.id ? { ...m, isCompleted: true, completedAt: now.getTime(), completedPhoto: photo, completedCrop: crops[matchedItem.id] } : m);
    const done = missions.every(m => m.isCompleted) && current.lastCompletedDate !== current.dateKey;
    const next = { ...current, missions,
      streak: done ? (current.lastCompletedDate === yesterday(current.dateKey) ? current.streak + 1 : 1) : current.streak,
      lastCompletedDate: done ? current.dateKey : current.lastCompletedDate,
    };
    return { state: lockMissions(next, now.getTime(), 'started'), celebration: { mission: missions.find(m => m.id === mission.id)!, matchedItem } };
  }
  return { state: current, celebration: null };
}
