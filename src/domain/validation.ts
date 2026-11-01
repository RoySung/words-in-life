import type { BoundingBox, VocabularyItem } from './vocabulary';

export const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const text = (value: unknown, fallback = ''): string => typeof value === 'string' ? value.trim() || fallback : fallback;
export const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').map(v => v.trim()).filter(Boolean) : [];
export const finite = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
export const wordKey = (word: string): string => word.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
export const wordId = (word: string): string => `word:${wordKey(word)}`;
export function imageUrl(value: unknown): string | undefined {
  const url = text(value);
  return /^(data:image\/(?:jpeg|png|webp|gif);base64,|blob:|https?:\/\/|\/(?!\/))/.test(url) ? url : undefined;
}
export function coordinate(value: unknown, min: number, max: number): number {
  let number = finite(value, 50);
  if (number > 0 && number <= 1) number *= 100;
  else if (number > 100) number /= 10;
  return Math.min(max, Math.max(min, Math.round(number)));
}
export function parseBoundingBox(value: unknown): BoundingBox | undefined {
  if (!record(value)) return undefined;
  const { left, top, right, bottom } = value;
  if (![left, top, right, bottom].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100)) return undefined;
  if (Number(right) <= Number(left) || Number(bottom) <= Number(top)) return undefined;
  return { left, top, right, bottom } as BoundingBox;
}
export function parseItem(value: unknown): VocabularyItem | null {
  if (!record(value) || !text(value.word) || !text(value.chinese)) return null;
  const word = text(value.word);
  const position = record(value.position) ? value.position : {};
  return {
    id: wordId(word), word, chinese: text(value.chinese),
    phonetic: text(value.phonetic), partOfSpeech: text(value.partOfSpeech, '名詞'),
    definition: text(value.definition, '日常物品'),
    exampleEn: text(value.exampleEn, `Look at the ${word}.`),
    exampleZh: text(value.exampleZh, `看著這個${text(value.chinese)}。`),
    collocations: strings(value.collocations), emoji: text(value.emoji, '✨'),
    boundingBox: parseBoundingBox(value.boundingBox),
    position: { x: coordinate(position.x, 8, 92), y: coordinate(position.y, 12, 88) },
  };
}
