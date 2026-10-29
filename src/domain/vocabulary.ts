import type { PhotoRef } from './photos';
export interface VocabularyItem {
  id: string;
  word: string;
  chinese: string;
  phonetic: string;
  partOfSpeech: string;
  definition: string;
  exampleEn: string;
  exampleZh: string;
  collocations: string[];
  emoji: string;
  position: {
    x: number; // percentage (8 to 92)
    y: number; // percentage (12 to 88)
  };
}
export interface Word {
  id: string;
  word: string;
  chinese: string;
  phonetic: string;
  partOfSpeech: string;
  definition: string;
  exampleEn: string;
  exampleZh: string;
  collocations: string[];
  emoji: string;
  savedAt: number;
  sceneTitle?: string;
  position?: {
    x: number;
    y: number;
  };
  photo?: PhotoRef;
  crop?: PhotoRef;
  photoCropVersion?: number;
  masteryScore?: number; // remembered reviews / total reviews, 0 to 100
  reviewCount?: number;
  rememberedCount?: number;
  lastReviewedAt?: number;
}
