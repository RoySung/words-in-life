import { IndexedDbLibraryRepository } from './repository/indexedDbRepository';
import { createPhotoUrls, preparePhoto } from './repository/photos';
import type { RecognitionRepository } from './repository/RecognitionRepository';
import { createLibraryUsecases } from './usecases/createLibraryUsecases';
import { createRecognitionUsecases } from './usecases/recognition';
import { INITIAL_SAVED_WORDS } from './features/collection/initialWords';
import { parseItem } from './domain/validation';
import { generateSticker, batchGenerateStickers } from './utils/stickerGenerator';
import { compressImage } from './utils/imageCompressor';
import { readGeminiKey } from './utils/geminiSettings';
import { AppError } from './repository/LibraryRepository';
import { createMissionGenerationUsecases } from './usecases/missionGeneration';

export function createServices() {
  const repository = new IndexedDbLibraryRepository();
  const deps = { now: () => Date.now(), createId: () => crypto.randomUUID() };
  const library = createLibraryUsecases(repository, deps);
  const photoUrls = createPhotoUrls(repository);
  const missionGeneration = createMissionGenerationUsecases(repository, { async generate(input, options) {
    if (!readGeminiKey()) throw new AppError('MissingCredential');
    const { createGeminiMissionRepository } = await import('./repository/gemini/missionRepository');
    options.signal.throwIfAborted();
    return createGeminiMissionRepository(readGeminiKey).generate(input, options);
  } }, { ...deps, timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone });
  const recognitionRepository: RecognitionRepository = { async analyze(input, options) {
    const { createGeminiRepository } = await import('./repository/gemini/geminiRepository');
    options.signal.throwIfAborted();
    return createGeminiRepository(readGeminiKey).analyze(input, options);
  } };
  const recognition = createRecognitionUsecases(recognitionRepository, {
    async compress(source, signal) {
      const compressed = await compressImage(source, 1280, .85, signal);
      const response = await fetch(compressed, { signal }); const blob = await response.blob();
      return { bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: blob.type };
    },
    crop: batchGenerateStickers,
  }, deps);
  const initialize = () => library.initialize(async () => {
    const prepared = await Promise.all(INITIAL_SAVED_WORDS.map(async word => {
      const source = word.originalImageUrl || word.imageUrl;
      const original = await preparePhoto(source);
      const crop = await preparePhoto(source && word.position ? await generateSticker(source, word.position) : undefined);
      return { word: { ...parseItem(word)!, savedAt: word.savedAt, sceneTitle: word.sceneTitle, photo: original.ref, crop: crop.ref }, photos: [...original.photos, ...crop.photos] };
    }));
    return { words: prepared.map(p => p.word), photos: prepared.flatMap(p => p.photos) };
  });
  return { library, recognition, missionGeneration, photoUrls, initialize, close() { missionGeneration.close(); photoUrls.close(); repository.close(); } };
}
export type Services = ReturnType<typeof createServices>;
