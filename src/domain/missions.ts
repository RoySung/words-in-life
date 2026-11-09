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
  replaced?: boolean;
  isCompleted: boolean;
  completedAt?: number;
  completedItem?: VocabularyItem;
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
export function generateDailyMissionsForDate(dateKey: string, knownWords: string[] = [], excludedWords: string[] = [], count = 3): DailyMission[] {
  // Simple deterministic hash based on date string
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash << 5) - hash + dateKey.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);

  const excluded = new Set(excludedWords.map(missionNameKey));
  const pool = MISSION_POOL.filter(m => !missionNames(m).some(name => excluded.has(missionNameKey(name))));
  const poolLen = pool.length;
  if (poolLen < count) return [];
  const idx1 = absHash % poolLen;
  const idx2 = (absHash * 7 + 3) % poolLen;
  const idx3 = (absHash * 13 + 7) % poolLen;

  // Preserve the date's ordering even when exclusions leave only one candidate.
  const selectedIdxs = [idx1];
  if (poolLen > 1) {
    if (!selectedIdxs.includes(idx2)) selectedIdxs.push(idx2);
    else selectedIdxs.push((idx2 + 1) % poolLen);
  }
  if (poolLen > 2) {
    if (!selectedIdxs.includes(idx3)) selectedIdxs.push(idx3);
    else {
      let next = (idx3 + 1) % poolLen;
      while (selectedIdxs.includes(next)) next = (next + 1) % poolLen;
      selectedIdxs.push(next);
    }
  }

  const known = new Set(knownWords.map(missionNameKey));
  const order = [...selectedIdxs, ...Array.from({ length: poolLen }, (_, i) => (idx1 + i) % poolLen).filter(i => !selectedIdxs.includes(i))];
  const fresh = order.filter(i => !missionNames(pool[i]).some(name => known.has(missionNameKey(name))));
  const selected = [...fresh, ...order.filter(i => !fresh.includes(i))].slice(0, count);
  return selected.map((poolIdx, i) => {
    const item = pool[poolIdx];
    return {
      ...item,
      kind: 'new' as const,
      id: `${dateKey}_m${i}_${item.targetWord}`,
      isCompleted: false,
    };
  });
}

export function missionNames(mission: Pick<DailyMission, 'targetWord' | 'synonyms'>): string[] {
  return [mission.targetWord, ...mission.synonyms].map(wordKey);
}

// Accept descriptive prefixes while keeping the object's full name at the end.
const modifiers = new Set(('a an the wooden wood plastic metal metallic steel stainless ceramic glass paper cotton leather rubber bamboo silver gold golden black white red blue green yellow brown gray grey orange pink purple small large big little long short round square old new modern empty full clear transparent clothes clothing coat').split(' '));
const pluralExceptions: Record<string, string> = { buses: 'bus', gases: 'gas', aliases: 'alias', quizzes: 'quiz', cookies: 'cookie', movies: 'movie', pies: 'pie', ties: 'tie' };
const singularNouns = new Set(['gas', 'lens', 'atlas', 'canvas', 'cosmos', 'news', 'series', 'species']);
function normalizedMissionName(value: string): string {
  return wordKey(value).replace(/-/g, ' ').split(' ').map(token => {
    if (modifiers.has(token) || singularNouns.has(token)) return token;
    if (Object.hasOwn(pluralExceptions, token)) return pluralExceptions[token];
    if (/(ss|x|zz|ch|sh)es$/.test(token)) return token.slice(0, -2);
    if (/[^aeiou]ies$/.test(token)) return token.slice(0, -3) + 'y';
    return token.endsWith('s') && !/(ss|us|is)$/.test(token) ? token.slice(0, -1) : token;
  }).join(' ');
}
export function missionNameKey(value: string): string {
  const tokens = normalizedMissionName(value).split(' ');
  // Exclusions identify the object regardless of its descriptive prefixes.
  // Keep a final material noun, so glass and glass bottle remain distinct.
  while (tokens.length > 1 && modifiers.has(tokens[0])) tokens.shift();
  return tokens.join(' ');
}
function matchesName(observed: string, target: string): boolean {
  // Completion still requires the target's full name, including its modifiers.
  const actual = normalizedMissionName(observed), expected = normalizedMissionName(target);
  if (actual === expected) return true;
  if (!expected || !actual.endsWith(` ${expected}`)) return false;
  return actual.slice(0, -expected.length).trim().split(' ').every(token => modifiers.has(token));
}
export function checkMissionMatch(mission: DailyMission, items: VocabularyItem[]): VocabularyItem | null {
  return items.find(item => missionNames(mission).some(target => matchesName(item.word, target))) || null;
}

export function replaceMission(state: MissionState, id: string, knownWords: string[]): MissionState {
  const target = state.missions.find(m => m.id === id);
  if (!target || target.isCompleted || target.replaced || state.generation?.status !== 'ready') return state;
  const excluded = [...(state.previousMissionWords || []), ...(state.replacedMissionWords || []), ...state.missions.flatMap(missionNames)];
  const replacement = generateDailyMissionsForDate(state.dateKey, knownWords, excluded, 1)[0];
  if (!replacement) return state;
  return { ...state, replacedMissionWords: [...(state.replacedMissionWords || []), ...missionNames(target)],
    missions: state.missions.map(m => m.id === id ? { ...replacement, id: `${id}_replacement`, replaced: true } : m) };
}

export interface MissionState {
  dateKey: string;
  missions: DailyMission[];
  streak: number;
  lastCompletedDate: string | null;
  generation?: MissionGeneration;
  previousMissionWords?: string[];
  replacedMissionWords?: string[];
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
  if (state.dateKey === today) return { ...state, streak };
  const previousMissionWords = state.dateKey === yesterday(today)
    ? [...state.missions.flatMap(missionNames), ...(state.replacedMissionWords || [])]
    : generateDailyMissionsForDate(yesterday(today)).flatMap(missionNames);
  return { ...state, dateKey: today, streak, previousMissionWords, replacedMissionWords: [],
    missions: generateDailyMissionsForDate(today, [], previousMissionWords), generation: { status: 'pending' } };
}
export function completeMission(state: MissionState, items: VocabularyItem[], photo: PhotoRef | undefined, targetId?: string, now = new Date(), crops: Record<string, PhotoRef | undefined> = {}) {
  const current = rollDate(state, getTodayDateKey(now));
  const pending = current.missions.filter(m => !m.isCompleted);
  const ordered = [...pending.filter(m => m.id === targetId), ...pending.filter(m => m.id !== targetId)];
  for (const mission of ordered) {
    const matchedItem = checkMissionMatch(mission, items);
    if (!matchedItem) continue;
    const missions = current.missions.map(m => m.id === mission.id ? { ...m, isCompleted: true, completedAt: now.getTime(), completedItem: { id: matchedItem.id, word: matchedItem.word, chinese: matchedItem.chinese, phonetic: matchedItem.phonetic, partOfSpeech: matchedItem.partOfSpeech, definition: matchedItem.definition, exampleEn: matchedItem.exampleEn, exampleZh: matchedItem.exampleZh, collocations: matchedItem.collocations, emoji: matchedItem.emoji, position: matchedItem.position, boundingBox: matchedItem.boundingBox }, completedPhoto: photo, completedCrop: crops[matchedItem.id] } : m);
    const done = missions.every(m => m.isCompleted) && current.lastCompletedDate !== current.dateKey;
    const next = { ...current, missions,
      streak: done ? (current.lastCompletedDate === yesterday(current.dateKey) ? current.streak + 1 : 1) : current.streak,
      lastCompletedDate: done ? current.dateKey : current.lastCompletedDate,
    };
    return { state: lockMissions(next, now.getTime(), 'started'), celebration: { mission: missions.find(m => m.id === mission.id)!, matchedItem } };
  }
  return { state: current, celebration: null };
}
