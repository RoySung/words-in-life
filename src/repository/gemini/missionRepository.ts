import { parseMissionDrafts } from '../../domain/missionGeneration';
import { AppError } from '../LibraryRepository';
import type { MissionGenerationRepository } from '../MissionGenerationRepository';
import { generateGeminiJson, GEMINI_MODELS } from './client';
import { makeMissionRequest } from './missionRequest';

export function createGeminiMissionRepository(getKey: () => string, models = GEMINI_MODELS): MissionGenerationRepository {
  return { async generate(input, { signal }) {
    const response = await generateGeminiJson(getKey, makeMissionRequest(input), { signal, models });
    try {
      const drafts = parseMissionDrafts(JSON.parse(response || '{}'));
      if (!drafts) throw new Error('Invalid missions');
      return drafts;
    } catch (cause) { throw new AppError('InvalidResponse', undefined, { cause }); }
  } };
}
