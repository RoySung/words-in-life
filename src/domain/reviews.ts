import type { Word } from './vocabulary';
export function reviewWord(word: Word, remembered: boolean, now = Date.now()): Word {
  const reviewCount = (word.reviewCount || 0) + 1;
  const rememberedCount = (word.rememberedCount || 0) + Number(remembered);
  return { ...word, reviewCount, rememberedCount, lastReviewedAt: now, masteryScore: Math.round(rememberedCount / reviewCount * 100) };
}
