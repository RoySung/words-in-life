import type { RecognitionResponse } from '../domain/recognition';
export interface RecognitionRequest { bytes: Uint8Array; mimeType: string; language: 'zh-TW'; maxItems: number }
export interface RecognitionRepository {
  analyze(input: RecognitionRequest, options: { signal: AbortSignal }): Promise<RecognitionResponse>;
}
