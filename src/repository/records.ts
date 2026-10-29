import { parseItem, record, finite } from '../domain/validation';
import type { Word } from '../domain/vocabulary';
import type { PhotoRef } from '../domain/photos';
import type { MissionState } from '../domain/missions';
import { AppError } from './LibraryRepository';
import { validMissionGeneration } from '../domain/missionGeneration';

export function validRef(ref: unknown): ref is PhotoRef | undefined {
  return ref === undefined || (record(ref) && (ref.kind === 'stored'
    ? typeof ref.photoId === 'string' && ref.photoId.startsWith('photo:')
    : ref.kind === 'asset' && typeof ref.path === 'string' && /^\/(?!\/)/.test(ref.path)));
}
export function validateWord(value: unknown): asserts value is Word {
  if (!record(value)) throw new AppError('InvalidData');
  const item = parseItem(value);
  if (!item || item.id !== value.id || !Number.isFinite(value.savedAt) || !validRef(value.photo) || !validRef(value.crop) ||
      ['reviewCount', 'rememberedCount', 'lastReviewedAt', 'masteryScore'].some(key => value[key] !== undefined && (typeof value[key] !== 'number' || finite(value[key], -1) < 0))) {
    throw new AppError('InvalidData');
  }
}
export function validateDaily(value: unknown): asserts value is MissionState {
  if (!record(value) || typeof value.dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.dateKey) ||
      !Number.isInteger(value.streak) || Number(value.streak) < 0 || !validMissionGeneration(value.generation) || !Array.isArray(value.missions) || value.missions.length !== 3 ||
      !value.missions.every(m => record(m) && typeof m.id === 'string' && typeof m.targetWord === 'string' && typeof m.targetChinese === 'string' &&
        Array.isArray(m.synonyms) && m.synonyms.every(s => typeof s === 'string') && typeof m.isCompleted === 'boolean' && validRef(m.completedPhoto) && validRef(m.completedCrop) &&
        (m.kind === undefined || m.kind === 'review' || m.kind === 'new') && (m.reason === undefined || typeof m.reason === 'string'))) {
    throw new AppError('InvalidData');
  }
}
