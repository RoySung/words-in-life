import type { PhotoRef } from './domain/photos';
export interface DetectedItem {
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
  photo?: PhotoRef;
  crop?: PhotoRef;
  stickerUrl?: string; // Cropped white-bordered sticker image
  originalImageUrl?: string; // Full source photo URL
}

export interface AnalysisResult {
  sceneTitle: string;
  sceneDescription: string;
  items: DetectedItem[];
  imageUrl: string;
  capturedAt: number;
  analysisId?: string;
}

export interface SavedWord {
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
  imageUrl?: string;
  originalImageUrl?: string;
  photo?: PhotoRef;
  crop?: PhotoRef;
  stickerUrl?: string;
  position?: {
    x: number;
    y: number;
  };
  photoCropVersion?: number;
  masteryScore?: number; // remembered reviews / total reviews, 0 to 100
  reviewCount?: number;
  rememberedCount?: number;
  lastReviewedAt?: number;
}

export interface SampleScene {
  id: string;
  name: string;
  category: string;
  thumbnail: string;
  imageUrl: string;
  sceneTitle: string;
  sceneDescription: string;
  items: DetectedItem[];
}

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
  completedPhoto?: PhotoRef;
  completedCrop?: PhotoRef;
  completedStickerUrl?: string;
  completedPhotoUrl?: string;
}

export type FailureReasonCode =
  | 'BLURRY_OR_DARK'
  | 'NO_ITEMS_FOUND'
  | 'TOO_FAR_OR_SMALL'
  | 'TARGET_QUEST_MISSED'
  | 'NETWORK_ERROR'
  | 'GENERIC_ERROR';

export interface RecognitionFailureInfo {
  reasonCode: FailureReasonCode;
  title: string;
  description: string;
  photoUrl: string;
  detectedCount?: number;
  suggestions: string[];
  activeQuestTarget?: DailyMission | null;
  detectedItems?: DetectedItem[]; // Items that WERE detected if this was a quest-missed scenario
}
