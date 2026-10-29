import type { RecognitionRepository } from '../repository/RecognitionRepository';
import type { VocabularyItem } from '../domain/vocabulary';
import { parseItem } from '../domain/validation';
import { AppError, type PhotoContent } from '../repository/LibraryRepository';
import type { RecognitionResponse } from '../domain/recognition';

export interface SceneInput { sceneTitle: string; sceneDescription: string; items: VocabularyItem[] }
export interface SceneResult extends SceneInput {
  items: (VocabularyItem & { stickerUrl?: string; originalImageUrl?: string })[];
  imageUrl: string; capturedAt: number; analysisId: string;
}
export interface RecognitionMedia {
  compress(source: string, signal: AbortSignal): Promise<PhotoContent>;
  crop(source: string, items: VocabularyItem[], signal: AbortSignal): Promise<SceneResult['items']>;
}
export function createRecognitionUsecases(repository: RecognitionRepository, media: RecognitionMedia, options: { now: () => number; createId: () => string; timeoutMs?: number }) {
  async function run(source: string, upstream: AbortSignal, sample?: SceneInput): Promise<{ success: true; scene: SceneResult } | Extract<RecognitionResponse, { success: false }>> {
    const controller = new AbortController();
    const abort = () => controller.abort(new AppError('Cancelled'));
    upstream.addEventListener('abort', abort, { once: true });
    if (upstream.aborted) abort();
    const timer = setTimeout(() => controller.abort(new AppError('Timeout')), options.timeoutMs ?? 25000);
    const signal = controller.signal;
    const analysisId = options.createId();
    let onAbort: () => void = () => {};
    try {
      const aborted = new Promise<never>((_, reject) => {
        onAbort = () => reject(signal.reason); signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) onAbort();
      });
      const work = (async () => {
        signal.throwIfAborted();
        let data: SceneInput;
        if (sample) {
          const items = sample.items.map(parseItem);
          if (items.some(item => !item)) throw new AppError('InvalidResponse');
          data = { ...sample, items: items.filter(item => item !== null) };
        } else {
          const image = await media.compress(source, signal);
          signal.throwIfAborted();
          const response = await repository.analyze({ ...image, language: 'zh-TW', maxItems: 8 }, { signal });
          signal.throwIfAborted();
          if (response.success === false) return response;
          const items = response.data.items.map(parseItem);
          if (!items.length || items.some(item => !item)) throw new AppError('InvalidResponse');
          data = { ...response.data, items: items.filter(item => item !== null) };
        }
        const items = await media.crop(source, data.items, signal);
        signal.throwIfAborted();
        return { success: true as const, scene: { ...data, items, imageUrl: source, capturedAt: options.now(), analysisId } };
      })();
      return await Promise.race([work, aborted]);
    } finally { clearTimeout(timer); upstream.removeEventListener('abort', abort); signal.removeEventListener('abort', onAbort); }
  }
  return {
    recognizePhoto: (source: string, signal: AbortSignal) => run(source, signal),
    prepareSampleScene: (source: string, sample: SceneInput, signal: AbortSignal) => run(source, signal, sample),
  };
}
export type RecognitionUsecases = ReturnType<typeof createRecognitionUsecases>;
