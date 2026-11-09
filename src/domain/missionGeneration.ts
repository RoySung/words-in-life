import type { DailyMission, MissionGeneration } from './missions';
import { missionNameKey } from './missions';
import type { Word } from './vocabulary';
import { finite, record, text, wordKey } from './validation';

export interface MissionWordSummary {
  word: string;
  chinese: string;
  reviewCount: number;
  rememberedCount: number;
  masteryScore: number;
  lastReviewedAt: number | null;
}
export interface MissionContext {
  dateKey: string;
  month: number;
  timeZone: string;
  knownWords: string[];
  excludedWords?: string[];
  reviewCandidates: MissionWordSummary[];
}
export type MissionDraft = Pick<DailyMission, 'targetWord' | 'targetChinese' | 'phonetic' | 'partOfSpeech' | 'emoji' | 'hint' | 'synonyms'> & { kind: 'review' | 'new'; reason: string };

export function createMissionContext(words: Word[], dateKey: string, timeZone: string, excludedWords: string[] = []): MissionContext {
  // Keep the request bounded; never include photos, examples, credentials or full records.
  return {
    dateKey, month: Number(dateKey.slice(5, 7)), timeZone,
    knownWords: [...new Set(words.map(w => w.word.slice(0, 80)))].slice(0, 500),
    excludedWords: [...new Set(excludedWords)],
    reviewCandidates: [],
  };
}
const boundedText = (value: unknown, max: number): value is string => typeof value === 'string' && !!value.trim() && value.length <= max && !/[\u0000-\u001f]/.test(value);
const englishObject = (value: unknown): value is string => boundedText(value, 60) && /^[a-z][a-z0-9 '\-]*$/i.test(value.trim());

export function parseMissionDrafts(value: unknown): MissionDraft[] | null {
  if (!record(value) || !Array.isArray(value.missions) || value.missions.length !== 3) return null;
  const drafts: MissionDraft[] = [];
  const acceptedNames = new Set<string>();
  for (const item of value.missions) {
    if (!record(item) || !englishObject(item.targetWord) || !boundedText(item.targetChinese, 80) ||
      !boundedText(item.phonetic, 100) || !boundedText(item.partOfSpeech, 20) || !boundedText(item.emoji, 16) ||
      !boundedText(item.hint, 160) || !boundedText(item.reason, 200) || item.kind !== 'new' ||
      !Array.isArray(item.synonyms) || item.synonyms.length > 8 || !item.synonyms.every(englishObject)) return null;
    const names = new Set([item.targetWord, ...item.synonyms].map(name => wordKey(name)));
    if ([...names].some(name => acceptedNames.has(name))) return null;
    names.forEach(name => acceptedNames.add(name));
    drafts.push({ targetWord: wordKey(item.targetWord), targetChinese: item.targetChinese.trim(), phonetic: item.phonetic.trim(),
      partOfSpeech: item.partOfSpeech.trim(), emoji: item.emoji.trim(), hint: item.hint.trim(), reason: item.reason.trim(),
      kind: item.kind as MissionDraft['kind'], synonyms: [...new Set(item.synonyms.map((name: string) => wordKey(name)))],
    });
  }
  return drafts;
}

export function generatedMissions(drafts: unknown, dateKey: string, words: Word[], excludedWords: string[] = []): DailyMission[] | null {
  const parsed = parseMissionDrafts({ missions: drafts });
  if (!parsed) return null;
  const known = new Set([...words.map(w => missionNameKey(w.word)), ...excludedWords.map(missionNameKey)]);
  if (parsed.some(m => [m.targetWord, ...m.synonyms].some(name => known.has(missionNameKey(name))))) return null;
  return parsed.map((draft, index) => ({ ...draft, id: `${dateKey}_ai${index}_${wordKey(draft.targetWord)}`, isCompleted: false }));
}

export function validMissionGeneration(value: unknown): value is MissionGeneration | undefined {
  if (value === undefined) return true; // Existing v1 records remain readable.
  if (!record(value)) return false;
  if (value.status === 'pending') return true;
  if (value.status === 'generating') return boundedText(value.requestId, 100) && finite(value.startedAt, -1) >= 0;
  return value.status === 'ready' && ['ai', 'fallback'].includes(text(value.source)) && finite(value.generatedAt, -1) >= 0 &&
    (value.fallbackReason === undefined || ['missing-key', 'generation-failed', 'started', 'interrupted'].includes(text(value.fallbackReason)));
}
