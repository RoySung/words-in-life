import type { MissionContext, MissionDraft } from '../domain/missionGeneration';

export interface MissionGenerationRepository {
  generate(input: MissionContext, options: { signal: AbortSignal }): Promise<MissionDraft[]>;
}
